import { Prisma, UserVocabularyProgress, Vocabulary } from '@prisma/client';

export const vocabularyListInclude = {
  meanings: {
    select: {
      meaning: true,
      isPrimary: true,
      position: true,
    },
    orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
  },
} satisfies Prisma.VocabularyInclude;

export type VocabularyListEntity = Prisma.VocabularyGetPayload<{
  include: typeof vocabularyListInclude;
}>;

export const vocabularyDetailInclude = {
  meanings: {
    orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
  },
  examples: {
    orderBy: { japanese: 'asc' as const },
    take: 10,
  },
} satisfies Prisma.VocabularyInclude;

export type VocabularyDetailEntity = Prisma.VocabularyGetPayload<{
  include: typeof vocabularyDetailInclude;
}>;

export type VocabularySearchEntity = Vocabulary;

export type UserVocabularyProgressEntity = UserVocabularyProgress;

export type VocabularyListInput = VocabularyListEntity | VocabularySearchEntity;
