import type { RawGrammarPattern, RawJlpt } from './raw-schema';
import { RawGrammarPatternSchema, RawJlptSchema } from './raw-schema';

export type ExtractIssueCode =
  | 'EMPTY_PATTERN'
  | 'INVALID_JLPT'
  | 'INVALID_POSITION'
  | 'DUPLICATE_PATTERN'
  | 'SCHEMA';

export interface ExtractIssue {
  code: ExtractIssueCode;
  message: string;
  pattern?: string;
  position?: number;
  previousPosition?: number;
}

export interface ExtractValidationResult {
  accepted: RawGrammarPattern[];
  rejected: Array<RawGrammarPattern & { rejectReason: string; rejectCode: ExtractIssueCode }>;
  issues: ExtractIssue[];
}

function sourceIdFor(jlpt: RawJlpt, position: number): string {
  return `${jlpt.toLowerCase()}-${String(position).padStart(3, '0')}`;
}

/**
 * Valida linhas brutas:
 * - pattern vazio
 * - JLPT inválido
 * - posição inválida
 * - duplicação (mesmo pattern em posições diferentes)
 */
export function validateRawPatterns(
  lines: string[],
  jlpt: string,
  source: string,
): ExtractValidationResult {
  const issues: ExtractIssue[] = [];
  const accepted: RawGrammarPattern[] = [];
  const rejected: ExtractValidationResult['rejected'] = [];
  const seen = new Map<string, number>();

  const jlptParsed = RawJlptSchema.safeParse(jlpt);
  if (!jlptParsed.success) {
    issues.push({
      code: 'INVALID_JLPT',
      message: `JLPT inválido: ${jlpt}`,
    });
    return { accepted, rejected, issues };
  }

  const level = jlptParsed.data;

  lines.forEach((rawPattern, index) => {
    const position = index + 1;
    const pattern = rawPattern.trim();

    if (!pattern) {
      issues.push({
        code: 'EMPTY_PATTERN',
        message: `pattern vazio na posição ${position}`,
        position,
      });
      return;
    }

    if (!Number.isInteger(position) || position < 1) {
      issues.push({
        code: 'INVALID_POSITION',
        message: `posição inválida: ${position}`,
        pattern,
        position,
      });
      return;
    }

    const previousPosition = seen.get(pattern);
    if (previousPosition !== undefined) {
      const issue: ExtractIssue = {
        code: 'DUPLICATE_PATTERN',
        message: `pattern idêntico em posições diferentes: "${pattern}" (#${previousPosition} e #${position})`,
        pattern,
        position,
        previousPosition,
      };
      issues.push(issue);

      const dupCandidate = {
        pattern,
        jlpt: level,
        source,
        sourceId: sourceIdFor(level, position),
        position,
        rejectReason: issue.message,
        rejectCode: issue.code,
      };
      rejected.push(dupCandidate);
      return;
    }

    const candidate = {
      pattern,
      jlpt: level,
      source,
      sourceId: sourceIdFor(level, position),
      position,
    };

    const parsed = RawGrammarPatternSchema.safeParse(candidate);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('; ');
      const code: ExtractIssueCode = message.includes('posição')
        ? 'INVALID_POSITION'
        : message.includes('JLPT') || message.toLowerCase().includes('jlpt')
          ? 'INVALID_JLPT'
          : message.includes('pattern')
            ? 'EMPTY_PATTERN'
            : 'SCHEMA';

      issues.push({ code, message, pattern, position });
      rejected.push({
        ...candidate,
        rejectReason: message,
        rejectCode: code,
      });
      return;
    }

    seen.set(pattern, position);
    accepted.push(parsed.data);
  });

  return { accepted, rejected, issues };
}
