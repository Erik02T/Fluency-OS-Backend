-- Drift alignment: remove columns present in local databases from a newer,
-- unapplied schema generation. The canonical schema for this service does not
-- include them; Prisma only writes the fields declared in prisma/schema.prisma.
-- IF EXISTS keeps this migration safe on fresh databases built solely from migrations.
ALTER TABLE "grammar_points"
  DROP COLUMN IF EXISTS "contentHash",
  DROP COLUMN IF EXISTS "contentVersion",
  DROP COLUMN IF EXISTS "reviewStatus",
  DROP COLUMN IF EXISTS "reviewedAt",
  DROP COLUMN IF EXISTS "source",
  DROP COLUMN IF EXISTS "sourceId",
  DROP COLUMN IF EXISTS "updatedAt",
  DROP COLUMN IF EXISTS "enrichmentData",
  DROP COLUMN IF EXISTS "patternFurigana",
  DROP COLUMN IF EXISTS "patternKanjiBreakdown";

-- Drop the enum type only if no column references it anymore.
DROP TYPE IF EXISTS "ReviewStatus";
