-- CreateEnum
CREATE TYPE "JlptLevel" AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "jlptGoal" "JlptLevel" NOT NULL DEFAULT 'N3',
    "dailyGoalMin" INTEGER NOT NULL DEFAULT 30,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kanji" (
    "id" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "unicodeCodepoint" TEXT NOT NULL,
    "jlptLevel" "JlptLevel" NOT NULL,
    "grade" INTEGER NOT NULL,
    "strokeCount" INTEGER NOT NULL,
    "frequencyRank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiMeaning" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanjiMeaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiReading" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "readingType" TEXT NOT NULL,
    "romanization" TEXT NOT NULL,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanjiReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiExample" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "jlptLevel" "JlptLevel" NOT NULL,
    "frequencyRank" INTEGER NOT NULL DEFAULT 0,
    "audioUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanjiExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Radical" (
    "id" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strokeCount" INTEGER NOT NULL,
    "meaning" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Radical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiRadical" (
    "kanjiId" TEXT NOT NULL,
    "radicalId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "KanjiRadical_pkey" PRIMARY KEY ("kanjiId","radicalId")
);

-- CreateTable
CREATE TABLE "UserKanjiProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "srsLevel" INTEGER NOT NULL DEFAULT 0,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "isFavorited" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "easeFactor" DECIMAL(65,30) NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKanjiProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Kanji_character_key" ON "Kanji"("character");

-- CreateIndex
CREATE UNIQUE INDEX "Kanji_unicodeCodepoint_key" ON "Kanji"("unicodeCodepoint");

-- CreateIndex
CREATE UNIQUE INDEX "Kanji_frequencyRank_key" ON "Kanji"("frequencyRank");

-- CreateIndex
CREATE INDEX "Kanji_jlptLevel_idx" ON "Kanji"("jlptLevel");

-- CreateIndex
CREATE INDEX "Kanji_frequencyRank_idx" ON "Kanji"("frequencyRank");

-- CreateIndex
CREATE INDEX "Kanji_grade_idx" ON "Kanji"("grade");

-- CreateIndex
CREATE INDEX "KanjiMeaning_kanjiId_idx" ON "KanjiMeaning"("kanjiId");

-- CreateIndex
CREATE UNIQUE INDEX "KanjiMeaning_kanjiId_meaning_language_key" ON "KanjiMeaning"("kanjiId", "meaning", "language");

-- CreateIndex
CREATE INDEX "KanjiReading_kanjiId_idx" ON "KanjiReading"("kanjiId");

-- CreateIndex
CREATE UNIQUE INDEX "KanjiReading_kanjiId_reading_readingType_key" ON "KanjiReading"("kanjiId", "reading", "readingType");

-- CreateIndex
CREATE INDEX "KanjiExample_kanjiId_idx" ON "KanjiExample"("kanjiId");

-- CreateIndex
CREATE INDEX "KanjiExample_jlptLevel_idx" ON "KanjiExample"("jlptLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Radical_character_key" ON "Radical"("character");

-- CreateIndex
CREATE UNIQUE INDEX "Radical_position_key" ON "Radical"("position");

-- CreateIndex
CREATE INDEX "KanjiRadical_kanjiId_idx" ON "KanjiRadical"("kanjiId");

-- CreateIndex
CREATE INDEX "KanjiRadical_radicalId_idx" ON "KanjiRadical"("radicalId");

-- CreateIndex
CREATE INDEX "UserKanjiProgress_userId_idx" ON "UserKanjiProgress"("userId");

-- CreateIndex
CREATE INDEX "UserKanjiProgress_userId_nextReviewAt_idx" ON "UserKanjiProgress"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "UserKanjiProgress_userId_isMastered_idx" ON "UserKanjiProgress"("userId", "isMastered");

-- CreateIndex
CREATE INDEX "UserKanjiProgress_kanjiId_idx" ON "UserKanjiProgress"("kanjiId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKanjiProgress_userId_kanjiId_key" ON "UserKanjiProgress"("userId", "kanjiId");

-- AddForeignKey
ALTER TABLE "KanjiMeaning" ADD CONSTRAINT "KanjiMeaning_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiReading" ADD CONSTRAINT "KanjiReading_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiExample" ADD CONSTRAINT "KanjiExample_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiRadical" ADD CONSTRAINT "KanjiRadical_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiRadical" ADD CONSTRAINT "KanjiRadical_radicalId_fkey" FOREIGN KEY ("radicalId") REFERENCES "Radical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKanjiProgress" ADD CONSTRAINT "UserKanjiProgress_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;
