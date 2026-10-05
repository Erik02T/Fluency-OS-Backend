import type { RawGrammarPattern } from './raw-schema';
import {
  canonicalizeJlpt,
  canonicalizePattern,
  deterministicId,
} from './canonicalize';
import type { NormalizedGrammarPattern } from './normalized-schema';
import { NormalizedGrammarPatternSchema } from './normalized-schema';

export interface NormalizeIssue {
  code: 'EMPTY_PATTERN' | 'DUPLICATE_PATTERN' | 'INVALID_JLPT' | 'SCHEMA';
  message: string;
  pattern?: string;
  originalPosition?: number;
  keptPosition?: number;
}

export interface NormalizeLevelResult {
  accepted: NormalizedGrammarPattern[];
  rejected: Array<{
    pattern: string;
    originalPattern: string;
    jlpt: string;
    source: string;
    originalPosition: number;
    rejectReason: string;
    rejectCode: NormalizeIssue['code'];
  }>;
  issues: NormalizeIssue[];
}

/**
 * RAW → CANONICAL:
 * padroniza caracteres, espaços, 〜, JLPT; ordena; deduplica; gera IDs.
 */
export function normalizeRawPatterns(
  rawItems: RawGrammarPattern[],
): NormalizeLevelResult {
  const issues: NormalizeIssue[] = [];
  const rejected: NormalizeLevelResult['rejected'] = [];

  const prepared = rawItems
    .map((item) => {
      let jlpt: ReturnType<typeof canonicalizeJlpt>;
      try {
        jlpt = canonicalizeJlpt(item.jlpt);
      } catch {
        issues.push({
          code: 'INVALID_JLPT',
          message: `JLPT inválido: ${item.jlpt}`,
          pattern: item.pattern,
          originalPosition: item.position,
        });
        rejected.push({
          pattern: item.pattern,
          originalPattern: item.pattern,
          jlpt: String(item.jlpt),
          source: item.source,
          originalPosition: item.position,
          rejectReason: `JLPT inválido: ${item.jlpt}`,
          rejectCode: 'INVALID_JLPT',
        });
        return null;
      }

      const pattern = canonicalizePattern(item.pattern);
      if (!pattern) {
        issues.push({
          code: 'EMPTY_PATTERN',
          message: `pattern vazio após normalização (posição original ${item.position})`,
          originalPosition: item.position,
        });
        rejected.push({
          pattern: '',
          originalPattern: item.pattern,
          jlpt,
          source: item.source,
          originalPosition: item.position,
          rejectReason: 'pattern vazio após normalização',
          rejectCode: 'EMPTY_PATTERN',
        });
        return null;
      }

      return {
        pattern,
        originalPattern: item.pattern,
        jlpt,
        source: item.source,
        originalPosition: item.position,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.originalPosition - b.originalPosition);

  const seen = new Map<string, number>();
  const unique: typeof prepared = [];

  for (const item of prepared) {
    const keptPosition = seen.get(item.pattern);
    if (keptPosition !== undefined) {
      const message = `duplicação canônica: "${item.pattern}" (mantido #${keptPosition}, rejeitado original #${item.originalPosition})`;
      issues.push({
        code: 'DUPLICATE_PATTERN',
        message,
        pattern: item.pattern,
        originalPosition: item.originalPosition,
        keptPosition,
      });
      rejected.push({
        pattern: item.pattern,
        originalPattern: item.originalPattern,
        jlpt: item.jlpt,
        source: item.source,
        originalPosition: item.originalPosition,
        rejectReason: message,
        rejectCode: 'DUPLICATE_PATTERN',
      });
      continue;
    }

    seen.set(item.pattern, item.originalPosition);
    unique.push(item);
  }

  const accepted: NormalizedGrammarPattern[] = [];

  unique.forEach((item, index) => {
    const position = index + 1;
    const candidate = {
      id: deterministicId(item.jlpt, position),
      pattern: item.pattern,
      jlpt: item.jlpt,
      position,
      source: item.source,
    };

    const parsed = NormalizedGrammarPatternSchema.safeParse(candidate);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('; ');
      issues.push({
        code: 'SCHEMA',
        message,
        pattern: item.pattern,
        originalPosition: item.originalPosition,
      });
      rejected.push({
        pattern: item.pattern,
        originalPattern: item.originalPattern,
        jlpt: item.jlpt,
        source: item.source,
        originalPosition: item.originalPosition,
        rejectReason: message,
        rejectCode: 'SCHEMA',
      });
      return;
    }

    accepted.push(parsed.data);
  });

  return { accepted, rejected, issues };
}
