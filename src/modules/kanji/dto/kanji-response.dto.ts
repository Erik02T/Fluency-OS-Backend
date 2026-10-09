import { JLPTLevel } from '@prisma/client';

// Resposta de lista (GET /kanji)
export class KanjiListResponseDto {
  id!: string;
  character!: string;
  meanings!: string[];
  onyomi!: string[];
  kunyomi!: string[];
  jlpt!: JLPTLevel;
  strokes!: number;
  frequency!: number;
  grade!: number;

  // Progresso do usuário (pode ser null se não tiver progresso)
  userProgress?: {
    srsLevel: number;
    isMastered: boolean;
    isFavorited: boolean;
    isSuspended: boolean;
  };
}

// Resposta paginada
export class PaginatedKanjiResponseDto {
  data!: KanjiListResponseDto[];
  pagination!: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}

// Resposta de detalhe (GET /kanji/:id)
export class KanjiDetailResponseDto {
  id!: string;
  character!: string;
  unicodeCodepoint!: string;
  jlpt!: JLPTLevel;
  strokes!: number;
  frequency!: number;
  grade!: number;

  meanings!: Array<{
    meaning: string;
    language: string;
    isPrimary: boolean;
  }>;

  readings!: {
    onyomi: Array<{
      reading: string;
      romanization: string;
      isCommon: boolean;
    }>;
    kunyomi: Array<{
      reading: string;
      romanization: string;
      isCommon: boolean;
    }>;
    nanori?: Array<{
      reading: string;
      romanization: string;
    }>;
  };

  examples!: Array<{
    word: string;
    reading: string;
    meaning: string;
    jlpt: JLPTLevel;
    audioUrl?: string;
  }>;

  radicals!: Array<{
    character: string;
    name: string;
    meaning: string;
    isPrimary: boolean;
  }>;

  // Progresso do usuário
  userProgress?: {
    srsLevel: number;
    isMastered: boolean;
    isFavorited: boolean;
    isSuspended: boolean;
    easeFactor: number;
    intervalDays: number;
    nextReviewAt: Date;
    lastReviewedAt?: Date;
    totalReviews: number;
    correctReviews: number;
    streak: number;
  };
}
