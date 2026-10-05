/*
  FASE 0 — Arquitetura de Dados: GrammarPoint
  Adiciona rastreabilidade, versionamento e controle de QA ao modelo GrammarPoint.

  Campos adicionados:
    source         — origem do dado (ex: "manual", "pdf-n5", "ai-generated")
    sourceId       — ID externo na fonte de origem
    contentVersion — versão do conteúdo (incrementar ao editar)
    contentHash    — SHA-256 do conteúdo para detecção de duplicatas
    reviewStatus   — ciclo de vida do ponto gramatical
    reviewedAt     — timestamp da última revisão humana
    updatedAt      — timestamp de última atualização (padrão Prisma)

  Nota: updatedAt é adicionado em dois passos para não quebrar linhas existentes.
*/

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED');

-- AlterTable: adiciona updatedAt com DEFAULT temporário para backfill seguro
ALTER TABLE "grammar_points"
  ADD COLUMN "contentHash"    VARCHAR(64),
  ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reviewStatus"   "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedAt"     TIMESTAMP(3),
  ADD COLUMN "source"         VARCHAR(200),
  ADD COLUMN "sourceId"       VARCHAR(200),
  ADD COLUMN "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT now();

-- Remove o DEFAULT de updatedAt (será gerenciado pelo Prisma/@updatedAt)
ALTER TABLE "grammar_points" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "grammar_points_reviewStatus_idx" ON "grammar_points"("reviewStatus");

-- CreateIndex
CREATE INDEX "grammar_points_source_sourceId_idx" ON "grammar_points"("source", "sourceId");

