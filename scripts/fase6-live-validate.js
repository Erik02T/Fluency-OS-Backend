/* eslint-disable @typescript-eslint/no-require-imports */
// Validação ao vivo da Fase 6: registra usuário via API, insere progresso
// conhecido via Prisma, compara GET /dashboard/summary com o banco e limpa.
const { PrismaClient } = require('@prisma/client');

const BASE = 'http://localhost:3099';
const suffix = Date.now().toString(36).slice(-5);
const email = `fase6-live-${suffix}@example.com`;
const emailB = `fase6-live-b-${suffix}@example.com`;
const password = 'SecurePass123';

async function main() {
  const prisma = new PrismaClient();
  const createdKanjiIds = [];
  const createdVocabIds = [];
  const createdGrammarIds = [];
  let userId = '';

  try {
    // 1. Registrar + logar via API real
    const reg = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Fase6 Live Validation' }),
    });
    if (reg.status !== 201 && reg.status !== 200) {
      throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
    }
    const login = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await login.json();
    const token = loginBody.accessToken;
    userId = loginBody.user.id;
    if (!token) throw new Error('no accessToken');
    console.log('user registered:', userId);

    // 2. Biblioteca + progresso conhecido via Prisma
    // character é VarChar(4) único — sufixo curto como no e2e.
    const base = Date.now().toString(36).slice(-2);
    for (let i = 0; i < 3; i += 1) {
      const k = await prisma.kanji.create({
        data: {
          character: `V${base}${i}`,
          jlptLevel: 'N5',
          unicodeCodepoint: `U+F6${base}${i}`,
          meanings: {
            create: { meaning: `kanji live ${i}`, isPrimary: true },
          },
        },
      });
      createdKanjiIds.push(k.id);
    }
    const v = await prisma.vocabulary.create({
      data: {
        word: `語彙Live${suffix}`,
        reading: `ごいらいぶ${suffix}`,
        jlptLevel: 'N5',
        tags: [],
      },
    });
    createdVocabIds.push(v.id);
    const g = await prisma.grammarPoint.create({
      data: {
        pattern: `〜ライブ${suffix}`,
        jlptLevel: 'N5',
        title: `Gramática live ${suffix}`,
        shortExplanation: 'Ponto gramatical de validação ao vivo',
      },
    });
    createdGrammarIds.push(g.id);

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Kanji 1: 10 reviews, 8 corretas, vencido (due), favorito
    await prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId: createdKanjiIds[0],
        isFavorite: true,
        totalReviews: 10,
        correctReviews: 8,
        lastReviewAt: yesterday,
        nextReviewAt: yesterday, // vencido
      },
    });
    // Kanji 2: mastered, não vencido
    await prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId: createdKanjiIds[1],
        isMastered: true,
        totalReviews: 2,
        correctReviews: 2,
        lastReviewAt: now,
        nextReviewAt: tomorrow,
      },
    });
    // Vocab: 4 reviews, 3 corretas, vencido
    await prisma.userVocabularyProgress.create({
      data: {
        userId,
        vocabularyId: createdVocabIds[0],
        totalReviews: 4,
        correctReviews: 3,
        lastReviewAt: now,
        nextReviewAt: yesterday, // vencido
      },
    });
    // Gramática: estudada
    await prisma.userGrammarProgress.create({
      data: { userId, grammarPointId: createdGrammarIds[0], isStudied: true },
    });
    // Streak
    await prisma.streak.upsert({
      where: { userId },
      update: { currentStreak: 3, longestStreak: 9 },
      create: { userId, currentStreak: 3, longestStreak: 9 },
    });

    // 3. Consultar API real
    const res = await fetch(`${BASE}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) {
      throw new Error(`summary failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    console.log('API response:', JSON.stringify(body, null, 2));

    // 4. Comparar com valores esperados calculados manualmente
    const expected = {
      kanjiStudied: 2,
      kanjiMastered: 1,
      dueReviews: 2, // 1 kanji vencido + 1 vocab vencido
      favoriteKanjis: 1,
      totalReviews: 16, // 12 + 4
      accuracyRate: 81.3, // (8+2+3)/16 = 81.25 -> 81.3
      currentStreak: 3,
      longestStreak: 9,
      vocabularyStudied: 1,
      vocabularyMastered: 0,
      grammarStudied: 1,
    };
    let ok = true;
    for (const [k, v2] of Object.entries(expected)) {
      const pass = body[k] === v2;
      if (!pass) ok = false;
      console.log(`${pass ? 'OK  ' : 'FAIL'} ${k}: api=${body[k]} expected=${v2}`);
    }
    const lastOk = typeof body.lastReviewAt === 'string';
    if (!lastOk) ok = false;
    console.log(`${lastOk ? 'OK  ' : 'FAIL'} lastReviewAt: ${body.lastReviewAt}`);

    // 5. Isolamento: usuário sem progresso recebe zeros
    const regB = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password, name: 'Dashboard B' }),
    });
    if (regB.status !== 201 && regB.status !== 200) {
      throw new Error(`register B failed: ${regB.status} ${await regB.text()}`);
    }
    const login2 = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password }),
    });
    const login2Body = await login2.json();
    const token2 = login2Body.accessToken;
    if (!token2) {
      throw new Error(`login B failed: ${login2.status} ${JSON.stringify(login2Body)}`);
    }
    const res2 = await fetch(`${BASE}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const body2 = await res2.json();
    const isolated =
      body2.kanjiStudied === 0 &&
      body2.vocabularyStudied === 0 &&
      body2.grammarStudied === 0 &&
      body2.totalReviews === 0 &&
      body2.currentStreak === 0;
    if (!isolated) ok = false;
    console.log(
      `${isolated ? 'OK  ' : 'FAIL'} isolation (user B): ${JSON.stringify(body2)}`,
    );

    // 6. Sem token -> 401
    const noAuth = await fetch(`${BASE}/dashboard/summary`);
    const unauth = noAuth.status === 401;
    if (!unauth) ok = false;
    console.log(`${unauth ? 'OK  ' : 'FAIL'} unauthenticated -> ${noAuth.status}`);

    console.log(ok ? '\nLIVE VALIDATION: PASS' : '\nLIVE VALIDATION: FAIL');
    if (!ok) process.exitCode = 1;
  } finally {
    // 7. Limpeza (apenas dados criados por este script)
    await prisma.userKanjiProgress.deleteMany({ where: { userId } });
    await prisma.userVocabularyProgress.deleteMany({ where: { userId } });
    await prisma.userGrammarProgress.deleteMany({ where: { userId } });
    await prisma.streak.deleteMany({ where: { userId } });
    await prisma.grammarPoint.deleteMany({ where: { id: { in: createdGrammarIds } } });
    await prisma.vocabulary.deleteMany({ where: { id: { in: createdVocabIds } } });
    await prisma.kanji.deleteMany({ where: { id: { in: createdKanjiIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [email, emailB] } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
