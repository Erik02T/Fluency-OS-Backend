import { ReviewStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  catalogs,
  grammarSchema,
  levels,
  manifestSchema,
  vocabularySchema,
  type Catalog,
  type CatalogRows,
  type Manifest,
} from './schema';

export const snapshotDirectory = join(__dirname, '../../seed/catalogs/v1');

export function sha256(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex');
}

export function vocabularyKey(row: { word: string; reading: string }): string {
  return JSON.stringify([row.word, row.reading]);
}

export function grammarKey(row: {
  source: string | null;
  sourceId: string | null;
}): string | undefined {
  return row.sourceId ? JSON.stringify([row.source, row.sourceId]) : undefined;
}

export function summarize({ vocabulary, grammar }: CatalogRows) {
  const stats = (rows: CatalogRows[Catalog], meanings: number) => {
    const byLevel = Object.fromEntries(
      levels.map((level) => [level, { records: 0, examples: 0 }]),
    ) as Manifest['vocabulary']['byLevel'];
    let examples = 0;
    for (const row of rows) {
      const level = byLevel[row.jlptLevel ?? 'UNKNOWN'];
      level.records++;
      level.examples += row.examples.length;
      examples += row.examples.length;
    }
    return { records: rows.length, examples, meanings, byLevel };
  };
  const sourceReviewStatuses = Object.fromEntries(
    Object.values(ReviewStatus).map((status) => [status, 0]),
  ) as Manifest['grammar']['sourceReviewStatuses'];
  let untranslatedExamples = 0;
  for (const point of grammar) {
    sourceReviewStatuses[point.reviewStatus]++;
    untranslatedExamples += point.examples.filter(
      ({ translation, japanese }) =>
        !translation.trim() || translation === japanese,
    ).length;
  }

  return {
    vocabulary: stats(
      vocabulary,
      vocabulary.reduce((total, row) => total + row.meanings.length, 0),
    ),
    grammar: {
      ...stats(grammar, 0),
      sourceReviewStatuses,
      untranslatedExamples,
      publishViaAdmin: true as const,
    },
  };
}

function assertUnique(values: Iterable<string | undefined>, name: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === undefined) continue;
    if (seen.has(value)) throw new Error('Duplicate ' + name + ': ' + value);
    seen.add(value);
  }
}

export function validateReferences({ vocabulary, grammar }: CatalogRows) {
  assertUnique(
    vocabulary.map((row) => row.id),
    'vocabulary ID',
  );
  assertUnique(vocabulary.map(vocabularyKey), 'word and reading');
  assertUnique(
    vocabulary.flatMap((row) => row.meanings.map(({ id }) => id)),
    'vocabulary meaning ID',
  );
  assertUnique(
    vocabulary.flatMap((row) => row.examples.map(({ id }) => id)),
    'vocabulary example ID',
  );
  assertUnique(
    grammar.map((row) => row.id),
    'grammar ID',
  );
  assertUnique(grammar.map(grammarKey), 'grammar source and source ID');
  assertUnique(
    grammar.flatMap((row) => row.examples.map(({ id }) => id)),
    'grammar example ID',
  );
}

export function loadSnapshot(directory = snapshotDirectory) {
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')),
  );
  const rows: CatalogRows = { vocabulary: [], grammar: [] };
  assertUnique(
    manifest.files.map((file) => file.path),
    'snapshot file',
  );
  for (const file of manifest.files) {
    if (!file.path.startsWith(file.catalog + '-')) {
      throw new Error('Catalog does not match file name: ' + file.path);
    }

    const contents = readFileSync(join(directory, file.path));
    if (sha256(contents) !== file.sha256) {
      throw new Error('SHA-256 mismatch: ' + file.path);
    }
    const body: unknown = JSON.parse(contents.toString('utf8'));
    const records =
      file.catalog === 'vocabulary'
        ? vocabularySchema.array().parse(body)
        : grammarSchema.array().parse(body);
    if (records.length !== file.records) {
      throw new Error('Record count mismatch: ' + file.path);
    }
    if (file.catalog === 'vocabulary') {
      rows.vocabulary.push(...(records as CatalogRows['vocabulary']));
    } else {
      rows.grammar.push(...(records as CatalogRows['grammar']));
    }
  }

  validateReferences(rows);
  const stats = summarize(rows);
  for (const catalog of catalogs) {
    if (
      !rows[catalog].length ||
      !isDeepStrictEqual(stats[catalog], manifest[catalog])
    ) {
      throw new Error('Manifest totals do not match ' + catalog);
    }
  }
  return { manifest, rows };
}
