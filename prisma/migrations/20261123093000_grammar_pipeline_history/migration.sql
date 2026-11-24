CREATE TABLE "grammar_pipeline_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT UNIQUE,
    "operation" TEXT NOT NULL,
    "level" "JLPTLevel",
    "rollbackId" TEXT,
    "dryRun" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3)
);

CREATE TABLE "grammar_pipeline_rollbacks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL UNIQUE,
    "level" "JLPTLevel" NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "grammar_pipeline_rollbacks_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "grammar_pipeline_runs"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "grammar_pipeline_runs_createdAt_idx" ON "grammar_pipeline_runs"("createdAt");
CREATE INDEX "grammar_pipeline_rollbacks_createdAt_idx" ON "grammar_pipeline_rollbacks"("createdAt");
