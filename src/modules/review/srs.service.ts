import { Injectable } from '@nestjs/common';

/**
 * Resultado do cálculo SRS (SM-2 adaptado).
 * Espelha SRSResult documentado em fluency-os-backend-spec.md (seção 8.2).
 */
export interface SRSResult {
  newSrsLevel: number;
  newEaseFactor: number;
  newIntervalDays: number;
  nextReviewAt: Date;
  isMastered: boolean;
}

/** Snapshot mínimo dos campos SRS necessários para o cálculo. */
export interface SRSProgressSnapshot {
  srsLevel: number;
  easeFactor: number;
  intervalDays: number;
}

/** Qualidades possíveis: 0 (falhou) · 1 (difícil) · 2 (ok) · 3 (fácil). */
export type SRSQuality = 0 | 1 | 2 | 3;

const MIN_EASE_FACTOR = 1.3;
const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 365;
const MASTERED_SRS_LEVEL = 5;

/**
 * SRSService — algoritmo SM-2 adaptado.
 *
 * Fonte autoritativa (idênticas entre si):
 * - backend/docs/architecture.md — tabela "Algoritmo SM-2 adaptado"
 * - backend/fluency-os-backend-spec.md — RN-SRS001..008 + fluxo (linhas 1620-1668)
 *
 * | quality | srs_level           | interval                | ease_factor   |
 * |--------|---------------------|-------------------------|---------------|
 * | 0      | MAX(1, atual - 1)   | 1 dia                   | não muda      |
 * | 1      | mantém              | interval × 1.2          | -0.15 (mín 1.3)|
 * | 2      | MIN(5, atual + 1)   | interval × ease_factor  | não muda      |
 * | 3      | MIN(5, atual + 1)   | interval × ease × 1.3   | +0.1          |
 *
 * Item é dominado quando srsLevel >= 5 (RN-K001).
 */
@Injectable()
export class SrsService {
  calculateNextReview(
    progress: SRSProgressSnapshot,
    quality: SRSQuality,
    now: Date = new Date(),
  ): SRSResult {
    const currentLevel = progress.srsLevel;
    const currentEase = progress.easeFactor;
    const currentInterval = Math.max(progress.intervalDays, MIN_INTERVAL_DAYS);

    let newSrsLevel = currentLevel;
    let newEaseFactor = currentEase;
    let newIntervalDays: number;

    switch (quality) {
      case 0: {
        // Falhou — reseta para o início do ciclo (RN-SRS003)
        newSrsLevel = Math.max(1, currentLevel - 1);
        newIntervalDays = 1;
        break;
      }
      case 1: {
        // Difícil — mantém nível, intervalo × 1.2, ease -0.15 (mín. 1.3)
        newIntervalDays = currentInterval * 1.2;
        newEaseFactor = Math.max(
          MIN_EASE_FACTOR,
          this.roundEase(currentEase - 0.15),
        );
        break;
      }
      case 2: {
        // OK — sobe nível, intervalo × ease_factor (RN-SRS005)
        newSrsLevel = Math.min(MASTERED_SRS_LEVEL, currentLevel + 1);
        newIntervalDays = currentInterval * currentEase;
        break;
      }
      case 3: {
        // Fácil — sobe nível, intervalo × ease × 1.3, ease +0.1
        newSrsLevel = Math.min(MASTERED_SRS_LEVEL, currentLevel + 1);
        newIntervalDays = currentInterval * currentEase * 1.3;
        newEaseFactor = this.roundEase(currentEase + 0.1);
        break;
      }
    }

    const clampedInterval = Math.min(
      MAX_INTERVAL_DAYS,
      Math.max(MIN_INTERVAL_DAYS, Math.ceil(newIntervalDays)),
    );

    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + clampedInterval);

    return {
      newSrsLevel,
      newEaseFactor,
      newIntervalDays: clampedInterval,
      nextReviewAt,
      isMastered: newSrsLevel >= MASTERED_SRS_LEVEL,
    };
  }

  private roundEase(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
