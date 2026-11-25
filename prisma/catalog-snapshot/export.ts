import { Prisma, PrismaClient } from '@prisma/client';
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  grammarSchema,
  levels,
  vocabularySchema,
  versionSchema,
  type Manifest,
} from './schema';
import {
  loadSnapshot,
  sha256,
  summarize,
  validateReferences,
} from './snapshot';

export const vocabularySelect = {
  id: true,
  word: true,
  reading: true,
  jlptLevel: true,
  frequency: true,
  partOfSpeech: true,
  tags: true,
  notes: true,
  audioUrl: true,
  meanings: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      meaning: true,
      context: true,
      isPrimary: true,
      position: true,
    },
  },
  examples: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      japanese: true,
      reading: true,
      translation: true,
      source: true,
    },
  },
} satisfies Prisma.VocabularySelect;

export const grammarSelect = {
  id: true,
  pattern: true,
  jlptLevel: true,
  title: true,
  shortExplanation: true,
  detailedExplanation: true,
  formalityLevel: true,
  difficulty: true,
  position: true,
  tags: true,
  source: true,
  sourceId: true,
  contentVersion: true,
  contentHash: true,
  reviewStatus: true,
  reviewedAt: true,
  enrichmentData: true,
  patternFurigana: true,
  patternKanjiBreakdown: true,
  examples: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      japanese: true,
      reading: true,
      translation: true,
      notes: true,
      isNatural: true,
      position: true,
      furigana: true,
      kanjiBreakdown: true,
      characterCount: true,
      wordCount: true,
    },
  },
} satisfies Prisma.GrammarPointSelect;

const sources: Manifest['sources'] = {
  vocabulary: [
    {
      name: 'JMdict (Electronic Dictionary Research and Development Group)',
      url: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
      licenseUrl: 'https://www.edrdg.org/edrdg/licence.html',
      attribution:
        'The vocabulary data in this application is derived from the JMdict dictionary file, which was compiled by the Electronic Dictionary Research and Development Group (EDRDG), and is used in conformance with the Group’s licence. See https://www.edrdg.org/ for more information.',
    },
    {
      name: 'jmdict-simplified',
      url: 'https://github.com/scriptin/jmdict-simplified',
      attribution:
        'JSON intermediario do JMdict, convertido em catálogo com seleção de pares de palavra e leitura e significados em inglês.',
    },
  ],
  grammar: [
    {
      name: 'Jonathan Waller (Tanos JLPT Grammar Lists)',
      url: 'https://www.tanos.co.uk/jlpt/skills/grammar/',
      licenseUrl: 'https://www.tanos.co.uk/jlpt/sharing/',
      attribution:
        'Listas de padrões JLPT de Jonathan Waller (Tanos), selecionadas e ordenadas no catálogo local.',
    },
    {
      name: 'Tatoeba',
      url: 'https://tatoeba.org/en/downloads',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/',
      attribution:
        'Frases japonesas do corpus Tatoeba selecionadas pelo pipeline de Gramática para N1 a N4.',
    },
    {
      name: 'Fluency OS',
      url: 'https://github.com/Erik02T/Fluency-OS-Backend',
      attribution:
        'Exemplos didáticos N5, com leituras e traduções, do seed de Gramática do Fluency OS.',
    },
  ],
};

export async function exportSnapshot(
  sourceUrl: string,
  version: string,
  output: string,
) {
  const datasetVersion = versionSchema.parse(version);
  const prisma = new PrismaClient({ datasourceUrl: sourceUrl });
  const rows = await prisma
    .$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const vocabulary = await tx.vocabulary.findMany({
          orderBy: { id: 'asc' },
          select: vocabularySelect,
        });
        const grammar = await tx.grammarPoint.findMany({
          orderBy: [{ jlptLevel: 'asc' }, { position: 'asc' }, { id: 'asc' }],
          select: grammarSelect,
        });
        return {
          vocabulary: vocabularySchema.array().parse(vocabulary),
          grammar: grammarSchema.array().parse(
            grammar.map(({ reviewedAt, ...point }) => ({
              ...point,
              reviewedAt: reviewedAt?.toISOString() ?? null,
            })),
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 120_000,
      },
    )
    .finally(() => prisma.$disconnect());

  validateReferences(rows);
  if (!rows.vocabulary.length || !rows.grammar.length) {
    throw new Error('Both source catalogs must contain records');
  }

  const destination = resolve(output);
  mkdirSync(dirname(destination), { recursive: true });
  const staging = mkdtempSync(
    join(dirname(destination), '.' + basename(destination) + '-'),
  );
  const files: Manifest['files'] = [];
  const writeShard = (
    catalog: 'vocabulary' | 'grammar',
    index: number,
    records: object[],
  ) => {
    const name = catalog + '-' + index.toString().padStart(3, '0') + '.json';
    const json =
      '[\n' + records.map((row) => JSON.stringify(row)).join(',\n') + '\n]\n';
    writeFileSync(join(staging, name), json);
    files.push({
      catalog,
      path: name,
      sha256: sha256(json),
      records: records.length,
    });
  };

  try {
    const shardSize = 1000;
    for (let index = 0; index < rows.vocabulary.length; index += shardSize) {
      writeShard(
        'vocabulary',
        index / shardSize + 1,
        rows.vocabulary.slice(index, index + shardSize),
      );
    }
    for (const [index, level] of levels.entries()) {
      const records = rows.grammar.filter((point) => point.jlptLevel === level);
      if (records.length) writeShard('grammar', index + 1, records);
    }
    const manifest: Manifest = {
      formatVersion: 1,
      datasetVersion,
      sources,
      files,
      ...summarize(rows),
    };
    writeFileSync(
      join(staging, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    loadSnapshot(staging);
    renameSync(staging, destination);
    return manifest;
  } finally {
    if (
      dirname(staging) === dirname(destination) &&
      basename(staging).startsWith('.' + basename(destination) + '-')
    ) {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
