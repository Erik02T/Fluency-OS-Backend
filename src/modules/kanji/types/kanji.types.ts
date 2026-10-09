import { Kanji, Prisma, UserKanjiProgress } from '@prisma/client';

export const kanjiListInclude = {
  meanings: {
    where: { language: 'pt-BR', isPrimary: true },
    select: { meaning: true },
  },
  readings: {
    select: {
      reading: true,
      type: true,
      isPrimary: true,
      romanji: true,
    },
  },
} satisfies Prisma.KanjiInclude;

export type KanjiListEntity = Prisma.KanjiGetPayload<{
  include: typeof kanjiListInclude;
}>;

export const kanjiDetailInclude = {
  meanings: {
    orderBy: { position: 'asc' as const },
  },
  readings: {
    orderBy: { reading: 'asc' as const },
  },
  examples: {
    take: 10,
    orderBy: { position: 'asc' as const },
  },
  radicals: {
    include: {
      radical: true,
    },
  },
} satisfies Prisma.KanjiInclude;

export type KanjiDetailEntity = Prisma.KanjiGetPayload<{
  include: typeof kanjiDetailInclude;
}>;

export type KanjiSearchEntity = Kanji;

export type UserKanjiProgressEntity = UserKanjiProgress;

export type KanjiListInput = KanjiListEntity | KanjiSearchEntity;
