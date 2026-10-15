/* Script temporário de validação da Fase 6 — apaga os dados que cria. */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.VALIDATION_USER_ID;
  if (!userId) {
    throw new Error('VALIDATION_USER_ID não definido');
  }

  const kanji = await prisma.kanji.create({
    data: {
      character: `V${Date.now().toString(36).slice(-3)}`,
      jlptLevel: 'N5',
      unicodeCodepoint: `U+F0${Date.now().toString(36).slice(-2)}`,
      meanings: {
        create: { meaning: 'kanji validacao fase 6', isPrimary: true },
      },
    },
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.userKanjiProgress.create({
    data: {
      userId,
      kanjiId: kanji.id,
      isMastered: true,
      isFavorite: true,
      totalReviews: 6,
      correctReviews: 5,
      lastReviewAt: yesterday,
      nextReviewAt: yesterday,
    },
  });
  await prisma.streak.update({
    where: { userId },
    data: { currentStreak: 3, longestStreak: 8 },
  });

  console.log('seeded', kanji.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
