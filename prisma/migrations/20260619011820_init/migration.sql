/*
  Warnings:

  - You are about to drop the `Kanji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KanjiExample` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KanjiMeaning` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KanjiRadical` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KanjiReading` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Radical` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserKanjiProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JLPTLevel" AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1');

-- CreateEnum
CREATE TYPE "ReadingType" AS ENUM ('ONYOMI', 'KUNYOMI', 'NANORI');

-- CreateEnum
CREATE TYPE "SRSItemType" AS ENUM ('KANJI', 'VOCABULARY', 'SENTENCE');

-- CreateEnum
CREATE TYPE "ReviewSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReviewQuality" AS ENUM ('BLACKOUT', 'WRONG', 'CORRECT_HARD', 'CORRECT_EASY');

-- CreateEnum
CREATE TYPE "ImmersionType" AS ENUM ('ANIME', 'DRAMA', 'PODCAST', 'YOUTUBE', 'MANGA', 'NOVEL', 'VISUAL_NOVEL', 'GAME', 'NEWS', 'MUSIC', 'MOVIE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REVIEW_DUE', 'STREAK_WARNING', 'STREAK_BROKEN', 'STREAK_MILESTONE', 'DAILY_GOAL_COMPLETED', 'MILESTONE_ACHIEVED', 'KANJI_MASTERED', 'SYSTEM_MESSAGE');

-- CreateEnum
CREATE TYPE "CustomListItemType" AS ENUM ('KANJI', 'VOCABULARY', 'SENTENCE');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('FIRST_REVIEW', 'FIRST_MASTERED', 'KANJIS_MASTERED_10', 'KANJIS_MASTERED_25', 'KANJIS_MASTERED_50', 'KANJIS_MASTERED_100', 'KANJIS_MASTERED_200', 'KANJIS_MASTERED_500', 'KANJIS_MASTERED_1000', 'VOCAB_MASTERED_100', 'VOCAB_MASTERED_500', 'VOCAB_MASTERED_1000', 'VOCAB_MASTERED_2000', 'STREAK_7_DAYS', 'STREAK_30_DAYS', 'STREAK_100_DAYS', 'STREAK_365_DAYS', 'REVIEWS_100', 'REVIEWS_1000', 'REVIEWS_5000', 'REVIEWS_10000', 'IMMERSION_10_HOURS', 'IMMERSION_50_HOURS', 'IMMERSION_100_HOURS', 'JLPT_N5_COMPLETE', 'JLPT_N4_COMPLETE', 'JLPT_N3_COMPLETE', 'SENTENCES_MINED_10', 'SENTENCES_MINED_100');

-- DropForeignKey
ALTER TABLE "KanjiExample" DROP CONSTRAINT "KanjiExample_kanjiId_fkey";

-- DropForeignKey
ALTER TABLE "KanjiMeaning" DROP CONSTRAINT "KanjiMeaning_kanjiId_fkey";

-- DropForeignKey
ALTER TABLE "KanjiRadical" DROP CONSTRAINT "KanjiRadical_kanjiId_fkey";

-- DropForeignKey
ALTER TABLE "KanjiRadical" DROP CONSTRAINT "KanjiRadical_radicalId_fkey";

-- DropForeignKey
ALTER TABLE "KanjiReading" DROP CONSTRAINT "KanjiReading_kanjiId_fkey";

-- DropForeignKey
ALTER TABLE "UserKanjiProgress" DROP CONSTRAINT "UserKanjiProgress_kanjiId_fkey";

-- DropTable
DROP TABLE "Kanji";

-- DropTable
DROP TABLE "KanjiExample";

-- DropTable
DROP TABLE "KanjiMeaning";

-- DropTable
DROP TABLE "KanjiRadical";

-- DropTable
DROP TABLE "KanjiReading";

-- DropTable
DROP TABLE "Radical";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserKanjiProgress";

-- DropEnum
DROP TYPE "JlptLevel";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(100),
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "jlptGoal" "JLPTLevel" NOT NULL DEFAULT 'N5',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'America/Sao_Paulo',
    "dailyKanjiGoal" INTEGER NOT NULL DEFAULT 10,
    "dailyVocabGoal" INTEGER NOT NULL DEFAULT 20,
    "dailyReviewGoal" INTEGER NOT NULL DEFAULT 50,
    "dailyImmersionGoal" INTEGER NOT NULL DEFAULT 30,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "streakFreezes" INTEGER NOT NULL DEFAULT 3,
    "srsMaxNewPerDay" INTEGER NOT NULL DEFAULT 20,
    "srsMaxReviewsPerDay" INTEGER NOT NULL DEFAULT 200,
    "uiLanguage" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "reviewReminderHour" INTEGER NOT NULL DEFAULT 9,
    "streakWarningHour" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "deviceInfo" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanjis" (
    "id" TEXT NOT NULL,
    "character" VARCHAR(4) NOT NULL,
    "jlptLevel" "JLPTLevel" NOT NULL,
    "grade" INTEGER,
    "strokeCount" INTEGER,
    "frequency" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanjis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_meanings" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "meaning" VARCHAR(200) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kanji_meanings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_readings" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "reading" VARCHAR(50) NOT NULL,
    "type" "ReadingType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "romanji" VARCHAR(50),

    CONSTRAINT "kanji_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_examples" (
    "id" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "word" VARCHAR(50) NOT NULL,
    "reading" VARCHAR(100) NOT NULL,
    "meaning" VARCHAR(300) NOT NULL,
    "jlptLevel" "JLPTLevel",
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kanji_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radicals" (
    "id" TEXT NOT NULL,
    "character" VARCHAR(4) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "meaning" VARCHAR(100) NOT NULL,
    "strokeCount" INTEGER NOT NULL,
    "position" VARCHAR(20),

    CONSTRAINT "radicals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_radicals" (
    "kanjiId" TEXT NOT NULL,
    "radicalId" TEXT NOT NULL,

    CONSTRAINT "kanji_radicals_pkey" PRIMARY KEY ("kanjiId","radicalId")
);

-- CreateTable
CREATE TABLE "user_kanji_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kanjiId" TEXT NOT NULL,
    "srsLevel" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewAt" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteredAt" TIMESTAMP(3),

    CONSTRAINT "user_kanji_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary" (
    "id" TEXT NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "reading" VARCHAR(200) NOT NULL,
    "jlptLevel" "JLPTLevel" NOT NULL,
    "frequency" INTEGER,
    "partOfSpeech" VARCHAR(50),
    "tags" TEXT[],
    "notes" TEXT,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_meanings" (
    "id" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "meaning" VARCHAR(300) NOT NULL,
    "context" VARCHAR(200),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vocabulary_meanings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_examples" (
    "id" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "japanese" TEXT NOT NULL,
    "reading" TEXT,
    "translation" TEXT NOT NULL,
    "source" VARCHAR(200),

    CONSTRAINT "vocabulary_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vocabulary_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "srsLevel" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewAt" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteredAt" TIMESTAMP(3),

    CONSTRAINT "user_vocabulary_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_points" (
    "id" TEXT NOT NULL,
    "pattern" VARCHAR(200) NOT NULL,
    "jlptLevel" "JLPTLevel" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "shortExplanation" VARCHAR(500) NOT NULL,
    "detailedExplanation" TEXT,
    "formalityLevel" VARCHAR(20) NOT NULL DEFAULT 'neutral',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_examples" (
    "id" TEXT NOT NULL,
    "grammarPointId" TEXT NOT NULL,
    "japanese" TEXT NOT NULL,
    "reading" TEXT,
    "translation" TEXT NOT NULL,
    "notes" VARCHAR(300),
    "isNatural" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grammar_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_grammar_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grammarPointId" TEXT NOT NULL,
    "isStudied" BOOLEAN NOT NULL DEFAULT false,
    "studiedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "confidenceLevel" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_grammar_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReviewSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "itemType" "SRSItemType" NOT NULL DEFAULT 'KANJI',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "correctItems" INTEGER NOT NULL DEFAULT 0,
    "accuracyRate" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),

    CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_answers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "itemType" "SRSItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "quality" "ReviewQuality" NOT NULL,
    "responseTimeMs" INTEGER,
    "srsLevelBefore" INTEGER NOT NULL,
    "srsLevelAfter" INTEGER NOT NULL,
    "intervalBefore" INTEGER NOT NULL,
    "intervalAfter" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" VARCHAR(10),
    "freezesAvailable" INTEGER NOT NULL DEFAULT 3,
    "freezesUsed" INTEGER NOT NULL DEFAULT 0,
    "totalActiveDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streakId" TEXT NOT NULL,
    "activityDate" VARCHAR(10) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "kanjiReviewed" INTEGER NOT NULL DEFAULT 0,
    "vocabReviewed" INTEGER NOT NULL DEFAULT 0,
    "immersionMins" INTEGER NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "wasFreeze" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalDate" VARCHAR(10) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "targetKanji" INTEGER NOT NULL DEFAULT 10,
    "targetVocab" INTEGER NOT NULL DEFAULT 20,
    "targetReviews" INTEGER NOT NULL DEFAULT 50,
    "targetImmersionMins" INTEGER NOT NULL DEFAULT 30,
    "completedKanji" INTEGER NOT NULL DEFAULT 0,
    "completedVocab" INTEGER NOT NULL DEFAULT 0,
    "completedReviews" INTEGER NOT NULL DEFAULT 0,
    "completedImmersionMins" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immersion_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ImmersionType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "episode" VARCHAR(100),
    "durationMinutes" INTEGER NOT NULL,
    "comprehension" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "immersion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mined_sentences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "immersionLogId" TEXT,
    "japanese" TEXT NOT NULL,
    "reading" TEXT,
    "translation" TEXT,
    "notes" TEXT,
    "source" VARCHAR(300),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mined_sentences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "itemType" "CustomListItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "kanjis_character_key" ON "kanjis"("character");

-- CreateIndex
CREATE INDEX "kanjis_jlptLevel_idx" ON "kanjis"("jlptLevel");

-- CreateIndex
CREATE INDEX "kanjis_frequency_idx" ON "kanjis"("frequency");

-- CreateIndex
CREATE INDEX "kanjis_grade_idx" ON "kanjis"("grade");

-- CreateIndex
CREATE INDEX "kanji_meanings_kanjiId_idx" ON "kanji_meanings"("kanjiId");

-- CreateIndex
CREATE INDEX "kanji_readings_kanjiId_idx" ON "kanji_readings"("kanjiId");

-- CreateIndex
CREATE INDEX "kanji_examples_kanjiId_idx" ON "kanji_examples"("kanjiId");

-- CreateIndex
CREATE UNIQUE INDEX "radicals_character_key" ON "radicals"("character");

-- CreateIndex
CREATE INDEX "user_kanji_progress_userId_nextReviewAt_idx" ON "user_kanji_progress"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "user_kanji_progress_userId_isMastered_idx" ON "user_kanji_progress"("userId", "isMastered");

-- CreateIndex
CREATE INDEX "user_kanji_progress_userId_isFavorite_idx" ON "user_kanji_progress"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "user_kanji_progress_userId_kanjiId_key" ON "user_kanji_progress"("userId", "kanjiId");

-- CreateIndex
CREATE INDEX "vocabulary_jlptLevel_idx" ON "vocabulary"("jlptLevel");

-- CreateIndex
CREATE INDEX "vocabulary_frequency_idx" ON "vocabulary"("frequency");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_word_reading_key" ON "vocabulary"("word", "reading");

-- CreateIndex
CREATE INDEX "vocabulary_meanings_vocabularyId_idx" ON "vocabulary_meanings"("vocabularyId");

-- CreateIndex
CREATE INDEX "vocabulary_examples_vocabularyId_idx" ON "vocabulary_examples"("vocabularyId");

-- CreateIndex
CREATE INDEX "user_vocabulary_progress_userId_nextReviewAt_idx" ON "user_vocabulary_progress"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "user_vocabulary_progress_userId_isMastered_idx" ON "user_vocabulary_progress"("userId", "isMastered");

-- CreateIndex
CREATE UNIQUE INDEX "user_vocabulary_progress_userId_vocabularyId_key" ON "user_vocabulary_progress"("userId", "vocabularyId");

-- CreateIndex
CREATE INDEX "grammar_points_jlptLevel_position_idx" ON "grammar_points"("jlptLevel", "position");

-- CreateIndex
CREATE INDEX "grammar_examples_grammarPointId_idx" ON "grammar_examples"("grammarPointId");

-- CreateIndex
CREATE UNIQUE INDEX "user_grammar_progress_userId_grammarPointId_key" ON "user_grammar_progress"("userId", "grammarPointId");

-- CreateIndex
CREATE INDEX "review_sessions_userId_startedAt_idx" ON "review_sessions"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "review_sessions_userId_status_idx" ON "review_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "review_answers_sessionId_idx" ON "review_answers"("sessionId");

-- CreateIndex
CREATE INDEX "review_answers_itemType_itemId_idx" ON "review_answers"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_userId_key" ON "streaks"("userId");

-- CreateIndex
CREATE INDEX "streak_history_userId_activityDate_idx" ON "streak_history"("userId", "activityDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "streak_history_userId_activityDate_key" ON "streak_history"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "daily_goals_userId_goalDate_idx" ON "daily_goals"("userId", "goalDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_goals_userId_goalDate_key" ON "daily_goals"("userId", "goalDate");

-- CreateIndex
CREATE INDEX "immersion_logs_userId_loggedAt_idx" ON "immersion_logs"("userId", "loggedAt" DESC);

-- CreateIndex
CREATE INDEX "immersion_logs_userId_type_idx" ON "immersion_logs"("userId", "type");

-- CreateIndex
CREATE INDEX "mined_sentences_userId_createdAt_idx" ON "mined_sentences"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "mined_sentences_userId_isFavorite_idx" ON "mined_sentences"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "custom_lists_userId_idx" ON "custom_lists"("userId");

-- CreateIndex
CREATE INDEX "custom_list_items_listId_position_idx" ON "custom_list_items"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_list_items_listId_itemType_itemId_key" ON "custom_list_items"("listId", "itemType", "itemId");

-- CreateIndex
CREATE INDEX "milestones_userId_achievedAt_idx" ON "milestones"("userId", "achievedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "milestones_userId_type_key" ON "milestones"("userId", "type");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji_meanings" ADD CONSTRAINT "kanji_meanings_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "kanjis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji_readings" ADD CONSTRAINT "kanji_readings_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "kanjis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji_examples" ADD CONSTRAINT "kanji_examples_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "kanjis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji_radicals" ADD CONSTRAINT "kanji_radicals_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "kanjis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji_radicals" ADD CONSTRAINT "kanji_radicals_radicalId_fkey" FOREIGN KEY ("radicalId") REFERENCES "radicals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_kanji_progress" ADD CONSTRAINT "user_kanji_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_kanji_progress" ADD CONSTRAINT "user_kanji_progress_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "kanjis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_meanings" ADD CONSTRAINT "vocabulary_meanings_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_examples" ADD CONSTRAINT "vocabulary_examples_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary_progress" ADD CONSTRAINT "user_vocabulary_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary_progress" ADD CONSTRAINT "user_vocabulary_progress_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_examples" ADD CONSTRAINT "grammar_examples_grammarPointId_fkey" FOREIGN KEY ("grammarPointId") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_grammar_progress" ADD CONSTRAINT "user_grammar_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_grammar_progress" ADD CONSTRAINT "user_grammar_progress_grammarPointId_fkey" FOREIGN KEY ("grammarPointId") REFERENCES "grammar_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_streakId_fkey" FOREIGN KEY ("streakId") REFERENCES "streaks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immersion_logs" ADD CONSTRAINT "immersion_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mined_sentences" ADD CONSTRAINT "mined_sentences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mined_sentences" ADD CONSTRAINT "mined_sentences_immersionLogId_fkey" FOREIGN KEY ("immersionLogId") REFERENCES "immersion_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_lists" ADD CONSTRAINT "custom_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_list_items" ADD CONSTRAINT "custom_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "custom_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_list_items" ADD CONSTRAINT "custom_list_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
