import { JLPTLevel, ReviewStatus } from '@prisma/client';
import { z } from 'zod';

const text = z.string();
const varchar = (length: number) => text.max(length);
const id = text.min(1);
const integer = z.number().int().min(-2147483648).max(2147483647);
const count = z.number().int().nonnegative();
const hash = text.regex(/^[a-f0-9]{64}$/);
const date = z.iso.datetime();
const jlpt = z.enum(JLPTLevel);
const status = z.enum(ReviewStatus);
const furigana = z.array(z.strictObject({ text, reading: text }));
const kanjiBreakdown = z.strictObject({
  uniqueKanji: z.array(
    z.strictObject({
      character: text,
      reading: text.optional(),
      meaning: text.optional(),
      jlpt: jlpt.optional(),
    }),
  ),
  totalKanjiCount: count,
});
const enrichmentMetadata = z.strictObject({
  enrichedAt: date,
  enricherVersion: text,
  totalUniqueKanji: count,
});
const enrichment = z.union([
  enrichmentMetadata,
  z.strictObject({
    metadata: enrichmentMetadata,
    furigana: z.strictObject({
      patternFurigana: furigana,
      exampleFurigana: z.array(furigana),
    }),
    kanjiBreakdown: z.strictObject({
      patternKanjiBreakdown: kanjiBreakdown,
      exampleKanjiBreakdown: z.array(kanjiBreakdown),
    }),
  }),
]);

export const meaningSchema = z.strictObject({
  id,
  meaning: varchar(300),
  context: varchar(200).nullable(),
  isPrimary: z.boolean(),
  position: integer,
});

export const vocabularyExampleSchema = z.strictObject({
  id,
  japanese: text,
  reading: text.nullable(),
  translation: text,
  source: varchar(200).nullable(),
});

export const vocabularySchema = z.strictObject({
  id,
  word: varchar(100).min(1),
  reading: varchar(200).min(1),
  jlptLevel: jlpt.nullable(),
  frequency: integer.nullable(),
  partOfSpeech: varchar(50).nullable(),
  tags: z.array(text),
  notes: text.nullable(),
  audioUrl: text.nullable(),
  meanings: z.array(meaningSchema).min(1),
  examples: z.array(vocabularyExampleSchema),
});

export const grammarExampleSchema = z.strictObject({
  id,
  japanese: text,
  reading: text.nullable(),
  translation: text,
  notes: varchar(300).nullable(),
  isNatural: z.boolean(),
  position: integer,
  furigana: furigana.nullable(),
  kanjiBreakdown: kanjiBreakdown.nullable(),
  characterCount: integer.nullable(),
  wordCount: integer.nullable(),
});

export const grammarSchema = z.strictObject({
  id,
  pattern: varchar(200).min(1),
  jlptLevel: jlpt,
  title: varchar(200),
  shortExplanation: varchar(500),
  detailedExplanation: text.nullable(),
  formalityLevel: varchar(20),
  difficulty: integer,
  position: integer,
  tags: z.array(text),
  source: varchar(200).nullable(),
  sourceId: varchar(200).nullable(),
  contentVersion: integer,
  contentHash: varchar(64).nullable(),
  reviewStatus: status,
  reviewedAt: date.nullable(),
  enrichmentData: enrichment.nullable(),
  patternFurigana: furigana.nullable(),
  patternKanjiBreakdown: kanjiBreakdown.nullable(),
  examples: z.array(grammarExampleSchema),
});

export const catalogs = ['vocabulary', 'grammar'] as const;
export const versionSchema = text.regex(/^\d+\.\d+\.\d+$/);
export const levels = ['N5', 'N4', 'N3', 'N2', 'N1', 'UNKNOWN'] as const;
const levelCounts = z.strictObject({ records: count, examples: count });
const stats = levelCounts.extend({
  meanings: count,
  byLevel: z.record(z.enum(levels), levelCounts),
});
const attribution = z.strictObject({
  name: text.min(1),
  url: z.url(),
  attribution: text.min(1),
  licenseUrl: z.url().optional(),
});

export const manifestSchema = z.strictObject({
  formatVersion: z.literal(1),
  datasetVersion: versionSchema,
  sources: z.strictObject({
    vocabulary: z.array(attribution).min(1),
    grammar: z.array(attribution).min(1),
  }),
  files: z
    .array(
      z.strictObject({
        catalog: z.enum(catalogs),
        path: text.regex(/^(vocabulary|grammar)-\d{3}\.json$/),
        sha256: hash,
        records: count.min(1),
      }),
    )
    .min(2),
  vocabulary: stats,
  grammar: stats.extend({
    sourceReviewStatuses: z.record(status, count),
    untranslatedExamples: count,
    publishViaAdmin: z.literal(true),
  }),
});

export type Vocabulary = z.infer<typeof vocabularySchema>;
export type Grammar = z.infer<typeof grammarSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Catalog = (typeof catalogs)[number];
export type CatalogRows = { vocabulary: Vocabulary[]; grammar: Grammar[] };
