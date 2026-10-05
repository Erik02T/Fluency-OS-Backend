import type { RawJlpt } from './raw-schema';
import { RawJlptSchema } from './raw-schema';

/** Forma canônica do placeholder de padrão gramatical (WAVE DASH U+301C). */
export const CANONICAL_WAVE_DASH = '〜';

/**
 * Padroniza caracteres tipográficos e espaçamento — sem inventar conteúdo.
 *
 * Regras:
 * - NFC
 * - tildes (～ ∼ ~ …) → 〜
 * - 下さい → ください
 * - trim + colapso de espaços
 * - remove espaços ao redor de / + … ,
 */
export function canonicalizePattern(input: string): string {
  let pattern = input.normalize('NFC').trim();

  pattern = pattern.replace(/[～∼⁓~]/g, CANONICAL_WAVE_DASH);

  pattern = pattern.replace(/下さい/g, 'ください');

  pattern = pattern.replace(/\s+/g, ' ').trim();
  pattern = pattern.replace(/\s*\/\s*/g, '/');
  pattern = pattern.replace(/\s*\+\s*/g, '+');
  pattern = pattern.replace(/\s*…\s*/g, '…');
  pattern = pattern.replace(/\s*,\s*/g, ',');

  return pattern;
}

/**
 * Padroniza nomes de nível JLPT → N5|N4|N3|N2|N1.
 */
export function canonicalizeJlpt(input: string): RawJlpt {
  const cleaned = input
    .normalize('NFC')
    .trim()
    .toUpperCase()
    .replace(/^JLPT\s*/i, '')
    .replace(/\s+/g, '');

  const withN = /^N[1-5]$/.test(cleaned)
    ? cleaned
    : /^[1-5]$/.test(cleaned)
      ? `N${cleaned}`
      : cleaned;

  return RawJlptSchema.parse(withN);
}

export function deterministicId(jlpt: RawJlpt, position: number): string {
  return `${jlpt}-${String(position).padStart(3, '0')}`;
}
