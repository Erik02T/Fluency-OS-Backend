import type { JLPTLevel } from '@prisma/client';

export type RawVocabularyEntry = {
  jmdictId: string;
  word: string;
  reading: string;
  alternativeReadings: string[];
  meanings: Array<{
    meaning: string;
    context?: string;
    language: string;
  }>;
  partOfSpeechTags: string[];
  isCommon: boolean;
  isRare: boolean;
  isObscure: boolean;
  fieldTags: string[];
  dialectTags: string[];
};

export type NormalizedVocabularyEntry = {
  jmdictId: string;
  word: string;
  reading: string;
  meanings: Array<{
    meaning: string;
    context?: string;
  }>;
  partOfSpeech?: string;
  tags: string[];
  notes?: string;
  selectionScore: number;
  hasFrequencyInfo: boolean;
  isCommon: boolean;
};

export type ValidatedVocabularyEntry = NormalizedVocabularyEntry & {
  isValid: boolean;
  validationErrors: string[];
};

export type VocabularyPrismaData = {
  word: string;
  reading: string;
  jlptLevel: JLPTLevel | null;
  frequency: number | null;
  partOfSpeech: string | null;
  tags: string[];
  notes: string | null;
  audioUrl: string | null;
  meanings: Array<{
    meaning: string;
    context: string | null;
    isPrimary: boolean;
    position: number;
  }>;
  examples: Array<{
    japanese: string;
    reading: string | null;
    translation: string;
    source: string | null;
  }>;
};

export type ImportSummary = {
  totalJmdictEntries: number;
  validEntries: number;
  selectedForImport: number;
  skippedInvalid: number;
  skippedDuplicated: number;
  alreadyExistsInDb: number;
  insertedInThisRun: number;
  updatedInThisRun: number;
  totalMeaningsInserted: number;
  totalExamplesInserted: number;
  withoutExamples: number;
  jlptDistribution: Record<JLPTLevel | 'UNKNOWN', number>;
  errorsLogged: string[];
};

export const DEFAULT_IMPORT_LIMIT = 8000;
