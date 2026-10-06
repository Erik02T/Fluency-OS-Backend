-- AlterTable
ALTER TABLE "streak_history" ADD COLUMN     "plannerTasksCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plannerTasksTotal" INTEGER NOT NULL DEFAULT 0;
