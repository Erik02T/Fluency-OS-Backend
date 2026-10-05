import { Prisma, UserGrammarProgress, GrammarPoint } from '@prisma/client';

export const grammarListInclude = {
  examples: {
    select: {
      japanese: true,
      reading: true,
      translation: true,
      position: true,
    },
    orderBy: { position: 'asc' as const },
    take: 2,
  },
} satisfies Prisma.GrammarPointInclude;

export type GrammarListEntity = Prisma.GrammarPointGetPayload<{
  include: typeof grammarListInclude;
}>;

export const grammarDetailInclude = {
  examples: {
    orderBy: { position: 'asc' as const },
  },
} satisfies Prisma.GrammarPointInclude;

export type GrammarDetailEntity = Prisma.GrammarPointGetPayload<{
  include: typeof grammarDetailInclude;
}>;

export type GrammarSearchEntity = GrammarPoint;

export type UserGrammarProgressEntity = UserGrammarProgress;

export type GrammarListInput = GrammarListEntity | GrammarSearchEntity;
