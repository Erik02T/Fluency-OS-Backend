/*
  CORRECTIVE MIGRATION — Fix missing grammar_points columns
  -------------------------------------------------------
  Issue: Migration 20260930145002_fase0_grammar_review_status was marked as applied
  but the actual database is missing critical columns: contentVersion, contentHash,
  reviewStatus, reviewedAt, and updatedAt.

  This migration safely adds the missing columns, checking for existence first.
  It also removes the spurious 'testcol' column if present.
*/

-- Create the ReviewStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
        CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED');
    END IF;
END $$;

-- Add missing columns with proper defaults for existing data
DO $$
BEGIN
    -- Add contentVersion with default 1 for existing rows
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'contentVersion') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- Add contentHash (nullable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'contentHash') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "contentHash" VARCHAR(64);
    END IF;

    -- Add reviewStatus with default PENDING for existing rows
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'reviewStatus') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
    END IF;

    -- Add reviewedAt (nullable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'reviewedAt') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "reviewedAt" TIMESTAMP(3);
    END IF;

    -- Add updatedAt with backfill to createdAt for existing rows
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'updatedAt') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
        -- Backfill existing rows with their createdAt value
        UPDATE "grammar_points" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
        -- Remove the default (Prisma will manage it via @updatedAt)
        ALTER TABLE "grammar_points" ALTER COLUMN "updatedAt" DROP DEFAULT;
    END IF;
END $$;

-- Remove the spurious testcol column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'testcol') THEN
        ALTER TABLE "grammar_points" DROP COLUMN "testcol";
    END IF;
END $$;

-- Create index on reviewStatus if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'grammar_points_reviewStatus_idx' AND schemaname = 'public') THEN
        CREATE INDEX "grammar_points_reviewStatus_idx" ON "grammar_points"("reviewStatus");
    END IF;
END $$;

-- Create index on (source, sourceId) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'grammar_points_source_sourceId_idx' AND schemaname = 'public') THEN
        CREATE INDEX "grammar_points_source_sourceId_idx" ON "grammar_points"("source", "sourceId");
    END IF;
END $$;

-- Add missing enrichment columns from migration 20260930190303
DO $$
BEGIN
    -- enrichmentData
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'enrichmentData') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "enrichmentData" JSONB;
    END IF;

    -- patternFurigana
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'patternFurigana') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "patternFurigana" JSONB;
    END IF;

    -- patternKanjiBreakdown
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'patternKanjiBreakdown') THEN
        ALTER TABLE "grammar_points" ADD COLUMN "patternKanjiBreakdown" JSONB;
    END IF;
END $$;

-- Add missing enrichment columns to grammar_examples table
DO $$
BEGIN
    -- characterCount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_examples' AND column_name = 'characterCount') THEN
        ALTER TABLE "grammar_examples" ADD COLUMN "characterCount" INTEGER;
    END IF;

    -- furigana
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_examples' AND column_name = 'furigana') THEN
        ALTER TABLE "grammar_examples" ADD COLUMN "furigana" JSONB;
    END IF;

    -- kanjiBreakdown
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_examples' AND column_name = 'kanjiBreakdown') THEN
        ALTER TABLE "grammar_examples" ADD COLUMN "kanjiBreakdown" JSONB;
    END IF;

    -- wordCount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_examples' AND column_name = 'wordCount') THEN
        ALTER TABLE "grammar_examples" ADD COLUMN "wordCount" INTEGER;
    END IF;
END $$;
