import { JLPTLevel } from '@prisma/client';

export class GrammarListResponseDto {
  id!: string;
  pattern!: string;
  title!: string;
  jlpt!: JLPTLevel;
  difficulty!: number;
  position!: number;
  formalityLevel!: string;
  tags!: string[];
  shortExplanation!: string;
  examplesPreview!: Array<{
    japanese: string;
    reading: string | null;
    translation: string;
  }>;

  userProgress?: {
    isStudied: boolean;
    isFavorited: boolean;
    confidenceLevel: number;
    reviewCount: number;
  };
}

export class PaginatedGrammarResponseDto {
  data!: GrammarListResponseDto[];
  pagination!: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}

export class GrammarDetailResponseDto {
  id!: string;
  pattern!: string;
  title!: string;
  jlpt!: JLPTLevel;
  difficulty!: number;
  position!: number;
  formalityLevel!: string;
  tags!: string[];
  shortExplanation!: string;
  detailedExplanation!: string | null;
  examples!: Array<{
    japanese: string;
    reading: string | null;
    translation: string;
    notes: string | null;
    isNatural: boolean;
  }>;

  userProgress?: {
    isStudied: boolean;
    studiedAt?: Date;
    isFavorited: boolean;
    confidenceLevel: number;
    notes?: string | null;
    reviewCount: number;
  };
}

export class GrammarProgressResponseDto {
  grammarPointId!: string;
  isStudied!: boolean;
  studiedAt?: Date;
  isFavorited!: boolean;
  confidenceLevel!: number;
  notes?: string | null;
  reviewCount!: number;
}
