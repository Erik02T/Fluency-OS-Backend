-- ============================================================================
-- Consolidação: PlannerHistory e campos de UI do Planner (Fase 5)
--
-- Adiciona histórico de transições de status (PlannerHistory), suporte a kanjiGlyph,
-- valor atual das metas semanais (currentValue) e índice composto em planner_tasks.
-- ============================================================================

-- Colunas de UI e acompanhamento
ALTER TABLE "planner_tasks" ADD COLUMN IF NOT EXISTS "kanjiGlyph" VARCHAR(8) NOT NULL DEFAULT '全';
ALTER TABLE "planner_tasks" ALTER COLUMN "estimatedMinutes" SET DEFAULT 20;

ALTER TABLE "weekly_goals" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) NOT NULL DEFAULT '?';
ALTER TABLE "weekly_goals" ADD COLUMN IF NOT EXISTS "kanjiGlyph" VARCHAR(8) NOT NULL DEFAULT '?';
ALTER TABLE "weekly_goals" ADD COLUMN IF NOT EXISTS "currentValue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "weekly_goals" ALTER COLUMN "targetValue" SET DEFAULT 0;

-- Histórico de transições de status
CREATE TABLE IF NOT EXISTS "planner_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "oldStatus" "PlannerTaskStatus" NOT NULL,
    "newStatus" "PlannerTaskStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planner_history_pkey" PRIMARY KEY ("id")
);

-- Índices adicionais
CREATE INDEX IF NOT EXISTS "planner_tasks_userId_date_status_idx" ON "planner_tasks"("userId", "date", "status");
CREATE INDEX IF NOT EXISTS "planner_history_taskId_changedAt_idx" ON "planner_history"("taskId", "changedAt" DESC);

-- Foreign Key para planner_history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_history_taskId_fkey') THEN
    ALTER TABLE "planner_history" ADD CONSTRAINT "planner_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "planner_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
