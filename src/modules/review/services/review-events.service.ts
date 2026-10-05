import { Injectable, Logger } from '@nestjs/common';
import { ReviewQuality } from '@prisma/client';
import { logStructured } from '../../../common/logging/structured-log';

export interface KanjiReviewedEvent {
  userId: string;
  kanjiId: string;
  quality: number | ReviewQuality;
  newSrsLevel: number;
}

export interface KanjiMasteredEvent {
  userId: string;
  kanjiId: string;
}

export interface SessionCompletedEvent {
  userId: string;
  sessionId: string;
  totalItems: number;
  reviewedItems: number;
  correctItems: number;
  accuracyRate: number;
  durationSeconds: number;
}

@Injectable()
export class ReviewEventsService {
  private readonly logger = new Logger(ReviewEventsService.name);

  emitKanjiReviewed(event: KanjiReviewedEvent): void {
    logStructured('info', 'ReviewEventsService', 'event.kanji_reviewed', {
      userId: event.userId,
      kanjiId: event.kanjiId,
      quality: event.quality,
      newSrsLevel: event.newSrsLevel,
    });
  }

  emitKanjiMastered(event: KanjiMasteredEvent): void {
    logStructured('info', 'ReviewEventsService', 'event.kanji_mastered', {
      userId: event.userId,
      kanjiId: event.kanjiId,
    });
  }

  emitSessionCompleted(event: SessionCompletedEvent): void {
    logStructured('info', 'ReviewEventsService', 'event.session_completed', {
      userId: event.userId,
      sessionId: event.sessionId,
      totalItems: event.totalItems,
      reviewedItems: event.reviewedItems,
      correctItems: event.correctItems,
      accuracyRate: event.accuracyRate,
      durationSeconds: event.durationSeconds,
    });
  }
}
