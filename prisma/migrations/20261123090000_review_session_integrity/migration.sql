BEGIN;

LOCK TABLE "review_answers", "review_sessions" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "review_answers"
    GROUP BY "sessionId", "itemType", "itemId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate review answers require reconciliation before this migration';
  END IF;
END $$;

ALTER TABLE "review_sessions" ADD COLUMN "cards" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "review_answers" ADD COLUMN "response" JSONB;

UPDATE "review_sessions" AS session
SET "completedItems" = totals.reviewed,
    "correctItems" = totals.correct,
    "accuracyRate" = CASE
      WHEN session."status" = 'COMPLETED' AND totals.reviewed > 0
      THEN totals.correct::double precision / totals.reviewed END
FROM (
  SELECT s."id", count(a."id")::int AS reviewed,
         (count(a."id") FILTER (
           WHERE a."quality" IN ('CORRECT_HARD', 'CORRECT_EASY')
         ))::int AS correct
  FROM "review_sessions" s
  LEFT JOIN "review_answers" a ON a."sessionId" = s."id" AND a."itemType" = s."itemType"
  GROUP BY s."id"
) AS totals
WHERE session."id" = totals."id";

UPDATE "review_sessions"
SET "status" = 'ABANDONED', "abandonedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'IN_PROGRESS';

CREATE UNIQUE INDEX "review_answers_sessionId_itemType_itemId_key"
ON "review_answers" ("sessionId", "itemType", "itemId");
DROP INDEX "review_answers_sessionId_idx";

COMMIT;
