import { PrismaService } from '../auth/repositories/prisma.service';
import { DashboardSummaryService } from './dashboard.service';

interface KanjiProgressFixture {
  studied: number;
  mastered: number;
  due: number;
  favorite: number;
  totalReviews: number;
  correctReviews: number;
  lastReviewAt: Date | null;
}

interface VocabularyProgressFixture {
  studied: number;
  mastered: number;
  due: number;
  totalReviews: number;
  correctReviews: number;
  lastReviewAt: Date | null;
}

interface PrismaFixture {
  kanji: KanjiProgressFixture;
  vocabulary: VocabularyProgressFixture;
  grammarStudied: number;
  streak: { currentStreak: number; longestStreak: number } | null;
  failWith?: Error;
}

const emptyFixture = (): PrismaFixture => ({
  kanji: {
    studied: 0,
    mastered: 0,
    due: 0,
    favorite: 0,
    totalReviews: 0,
    correctReviews: 0,
    lastReviewAt: null,
  },
  vocabulary: {
    studied: 0,
    mastered: 0,
    due: 0,
    totalReviews: 0,
    correctReviews: 0,
    lastReviewAt: null,
  },
  grammarStudied: 0,
  streak: null,
});

/**
 * Cria um mock de PrismaService que responde por usuário com dados
 * controlados, permitindo validar agregações e isolamento.
 */
function createPrismaMock(fixtures: Record<string, PrismaFixture>) {
  const resolveFor = <T>(
    userId: string,
    value: (fixture: PrismaFixture) => T,
  ): Promise<T> => {
    const fixture = fixtures[userId];
    if (!fixture) {
      return Promise.reject(new Error(`unexpected userId: ${userId}`));
    }
    if (fixture.failWith) {
      return Promise.reject(fixture.failWith);
    }
    return Promise.resolve(value(fixture));
  };

  const countByWhere =
    (
      pick: (fixture: PrismaFixture, where: Record<string, unknown>) => number,
    ) =>
    (args: { where: { userId: string } & Record<string, unknown> }) =>
      resolveFor(args.where.userId, (fixture) => pick(fixture, args.where));

  const kanjiCount = countByWhere((fixture, where) => {
    if (where.isFavorite !== undefined) {
      return fixture.kanji.favorite;
    }
    if (where.nextReviewAt !== undefined) {
      return fixture.kanji.due;
    }
    if (where.isMastered !== undefined) {
      return fixture.kanji.mastered;
    }
    return fixture.kanji.studied;
  });

  const vocabularyCount = countByWhere((fixture, where) => {
    if (where.nextReviewAt !== undefined) {
      return fixture.vocabulary.due;
    }
    if (where.isMastered !== undefined) {
      return fixture.vocabulary.mastered;
    }
    return fixture.vocabulary.studied;
  });

  return {
    userKanjiProgress: {
      count: jest.fn(kanjiCount),
      aggregate: jest.fn((args: { where: { userId: string } }) =>
        resolveFor(args.where.userId, (fixture) => ({
          _sum: {
            totalReviews: fixture.kanji.totalReviews,
            correctReviews: fixture.kanji.correctReviews,
          },
        })),
      ),
      findFirst: jest.fn((args: { where: { userId: string } }) =>
        resolveFor(args.where.userId, (fixture) =>
          fixture.kanji.lastReviewAt
            ? { lastReviewAt: fixture.kanji.lastReviewAt }
            : null,
        ),
      ),
    },
    userVocabularyProgress: {
      count: jest.fn(vocabularyCount),
      aggregate: jest.fn((args: { where: { userId: string } }) =>
        resolveFor(args.where.userId, (fixture) => ({
          _sum: {
            totalReviews: fixture.vocabulary.totalReviews,
            correctReviews: fixture.vocabulary.correctReviews,
          },
        })),
      ),
      findFirst: jest.fn((args: { where: { userId: string } }) =>
        resolveFor(args.where.userId, (fixture) =>
          fixture.vocabulary.lastReviewAt
            ? { lastReviewAt: fixture.vocabulary.lastReviewAt }
            : null,
        ),
      ),
    },
    userGrammarProgress: {
      count: jest.fn(countByWhere((fixture) => fixture.grammarStudied)),
    },
    streak: {
      findUnique: jest.fn((args: { where: { userId: string } }) =>
        resolveFor(args.where.userId, (fixture) => fixture.streak),
      ),
    },
    // Totais de biblioteca — nunca devem vazar para o resumo individual.
    kanji: { count: jest.fn() },
    vocabulary: { count: jest.fn() },
    grammarPoint: { count: jest.fn() },
  };
}

function createService(fixtures: Record<string, PrismaFixture>): {
  service: DashboardSummaryService;
  prisma: ReturnType<typeof createPrismaMock>;
} {
  const prisma = createPrismaMock(fixtures);
  const service = new DashboardSummaryService(
    prisma as unknown as PrismaService,
  );
  return { service, prisma };
}

describe('DashboardSummaryService', () => {
  it('agrega métricas reais de kanji, vocabulário, gramática e streak', async () => {
    const olderReview = new Date('2026-10-01T10:00:00.000Z');
    const newerReview = new Date('2026-10-05T10:00:00.000Z');

    const { service } = createService({
      'user-a': {
        kanji: {
          studied: 12,
          mastered: 5,
          due: 3,
          favorite: 2,
          totalReviews: 40,
          correctReviews: 34,
          lastReviewAt: olderReview,
        },
        vocabulary: {
          studied: 30,
          mastered: 8,
          due: 4,
          totalReviews: 10,
          correctReviews: 6,
          lastReviewAt: newerReview,
        },
        grammarStudied: 7,
        streak: { currentStreak: 6, longestStreak: 15 },
      },
    });

    const result = await service.getSummary('user-a');

    expect(result).toEqual({
      kanjiStudied: 12,
      kanjiMastered: 5,
      dueReviews: 7,
      favoriteKanjis: 2,
      totalReviews: 50,
      accuracyRate: 80,
      currentStreak: 6,
      longestStreak: 15,
      lastReviewAt: newerReview.toISOString(),
      vocabularyStudied: 30,
      vocabularyMastered: 8,
      grammarStudied: 7,
    });
  });

  it('retorna zeros quando o usuário não tem progresso nem streak', async () => {
    const { service } = createService({ 'user-b': emptyFixture() });

    const result = await service.getSummary('user-b');

    expect(result).toEqual({
      kanjiStudied: 0,
      kanjiMastered: 0,
      dueReviews: 0,
      favoriteKanjis: 0,
      totalReviews: 0,
      accuracyRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastReviewAt: null,
      vocabularyStudied: 0,
      vocabularyMastered: 0,
      grammarStudied: 0,
    });
  });

  it('não confunde o total da biblioteca com o progresso individual', async () => {
    const { service, prisma } = createService({ 'user-c': emptyFixture() });

    // Biblioteca pode ter muitos itens; o resumo só consulta progresso do usuário.
    const result = await service.getSummary('user-c');

    expect(result.kanjiStudied).toBe(0);
    expect(result.vocabularyStudied).toBe(0);
    expect(result.grammarStudied).toBe(0);
    expect(prisma.kanji.count).not.toHaveBeenCalled();
    expect(prisma.vocabulary.count).not.toHaveBeenCalled();
    expect(prisma.grammarPoint.count).not.toHaveBeenCalled();
  });

  it('usa o registro real de streak quando existe', async () => {
    const { service } = createService({
      'user-d': {
        ...emptyFixture(),
        streak: { currentStreak: 4, longestStreak: 11 },
      },
    });

    const result = await service.getSummary('user-d');

    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(11);
  });

  it('retorna 0 para streak apenas quando não há registro', async () => {
    const { service, prisma } = createService({ 'user-e': emptyFixture() });

    const result = await service.getSummary('user-e');

    expect(prisma.streak.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-e' } }),
    );
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
  });
});

describe('DashboardSummaryService — regras de cálculo e segurança', () => {
  it('aplica a mesma regra de reviews pendentes do módulo de Review', async () => {
    const { service, prisma } = createService({
      'user-f': {
        ...emptyFixture(),
        kanji: { ...emptyFixture().kanji, due: 2 },
        vocabulary: { ...emptyFixture().vocabulary, due: 5 },
      },
    });

    const result = await service.getSummary('user-f');

    expect(result.dueReviews).toBe(7);

    const kanjiDueCall = prisma.userKanjiProgress.count.mock.calls.find(
      ([args]) =>
        (args as { where: Record<string, unknown> }).where.nextReviewAt !==
        undefined,
    );
    const vocabularyDueCall =
      prisma.userVocabularyProgress.count.mock.calls.find(
        ([args]) =>
          (args as { where: Record<string, unknown> }).where.nextReviewAt !==
          undefined,
      );

    expect(kanjiDueCall?.[0]).toEqual({
      where: {
        userId: 'user-f',
        isSuspended: false,
        nextReviewAt: { lte: expect.any(Date) as Date },
      },
    });
    expect(vocabularyDueCall?.[0]).toEqual({
      where: {
        userId: 'user-f',
        isSuspended: false,
        nextReviewAt: { lte: expect.any(Date) as Date },
      },
    });
  });

  it('calcula accuracyRate sobre kanji + vocabulário e retorna 0 sem revisões', async () => {
    const { service } = createService({
      'user-g': {
        ...emptyFixture(),
        kanji: { ...emptyFixture().kanji, totalReviews: 9, correctReviews: 7 },
        vocabulary: {
          ...emptyFixture().vocabulary,
          totalReviews: 3,
          correctReviews: 1,
        },
      },
      'user-h': emptyFixture(),
    });

    const withReviews = await service.getSummary('user-g');
    expect(withReviews.totalReviews).toBe(12);
    expect(withReviews.accuracyRate).toBe(66.7);

    const withoutReviews = await service.getSummary('user-h');
    expect(withoutReviews.totalReviews).toBe(0);
    expect(withoutReviews.accuracyRate).toBe(0);
  });

  it('escolhe o lastReviewAt mais recente entre kanji e vocabulário', async () => {
    const kanjiReview = new Date('2026-10-02T08:00:00.000Z');
    const vocabularyReview = new Date('2026-10-04T08:00:00.000Z');

    const { service } = createService({
      'user-i': {
        ...emptyFixture(),
        kanji: { ...emptyFixture().kanji, lastReviewAt: kanjiReview },
        vocabulary: {
          ...emptyFixture().vocabulary,
          lastReviewAt: vocabularyReview,
        },
      },
    });

    const result = await service.getSummary('user-i');
    expect(result.lastReviewAt).toBe(vocabularyReview.toISOString());
  });

  it('propaga falha do Prisma sem mascarar o erro', async () => {
    const { service } = createService({
      'user-k': { ...emptyFixture(), failWith: new Error('db indisponível') },
    });

    await expect(service.getSummary('user-k')).rejects.toThrow(
      'db indisponível',
    );
  });

  it('filtra todas as consultas pelo userId autenticado (isolamento)', async () => {
    const { service, prisma } = createService({
      'user-a': {
        ...emptyFixture(),
        kanji: {
          ...emptyFixture().kanji,
          studied: 3,
          totalReviews: 4,
          correctReviews: 4,
        },
        streak: { currentStreak: 2, longestStreak: 5 },
      },
      'user-b': {
        ...emptyFixture(),
        kanji: { ...emptyFixture().kanji, studied: 10 },
        vocabulary: { ...emptyFixture().vocabulary, studied: 20 },
        grammarStudied: 4,
      },
    });

    const summaryA = await service.getSummary('user-a');
    const summaryB = await service.getSummary('user-b');

    // O resumo de A não contém progresso de B e vice-versa.
    expect(summaryA.kanjiStudied).toBe(3);
    expect(summaryA.vocabularyStudied).toBe(0);
    expect(summaryA.grammarStudied).toBe(0);
    expect(summaryB.kanjiStudied).toBe(10);
    expect(summaryB.vocabularyStudied).toBe(20);
    expect(summaryB.grammarStudied).toBe(4);
    expect(summaryB.currentStreak).toBe(0);

    // Toda consulta é escopada pelo usuário autenticado.
    const scopedCalls: unknown[][] = [
      ...prisma.userKanjiProgress.count.mock.calls,
      ...prisma.userKanjiProgress.aggregate.mock.calls,
      ...prisma.userKanjiProgress.findFirst.mock.calls,
      ...prisma.userVocabularyProgress.count.mock.calls,
      ...prisma.userVocabularyProgress.aggregate.mock.calls,
      ...prisma.userVocabularyProgress.findFirst.mock.calls,
      ...prisma.userGrammarProgress.count.mock.calls,
      ...prisma.streak.findUnique.mock.calls,
    ];
    for (const [args] of scopedCalls) {
      const where = (args as { where: { userId: string } }).where;
      expect(['user-a', 'user-b']).toContain(where.userId);
    }
  });
});
