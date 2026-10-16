-- Fix grammar_points sourceId column case mismatch
-- Renames column sourceid to sourceId if needed
-- Renames index grammar_points_source_sourceid_idx to grammar_points_source_sourceId_idx if needed

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'sourceId') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grammar_points' AND column_name = 'sourceid') THEN
            ALTER TABLE "grammar_points" RENAME COLUMN sourceid TO "sourceId";
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'grammar_points_source_sourceId_idx' AND schemaname = 'public') THEN
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'grammar_points_source_sourceid_idx' AND schemaname = 'public') THEN
            ALTER INDEX "grammar_points_source_sourceid_idx" RENAME TO "grammar_points_source_sourceId_idx";
        END IF;
    END IF;
END $$;