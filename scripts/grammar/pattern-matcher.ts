import fs from 'node:fs';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { canonicalizePattern } from './canonicalize';

export const PatternMatchModeSchema = z.enum([
  'literal',
  'normalized',
  'regex',
]);

const PatternMatchRequestSchema = z.object({
  pattern: z.string().trim().min(1).max(256),
  mode: PatternMatchModeSchema.default('regex'),
  limit: z.number().int().min(1).max(1000).default(50),
});

export type PatternMatchMode = z.infer<typeof PatternMatchModeSchema>;

interface SentenceSearchRow {
  sentence_id: string;
  language: 'jpn';
  japanese: string;
}

export interface PatternMatchCandidate {
  sentenceId: string;
  language: 'jpn';
  japanese: string;
  matchedBy: PatternMatchMode;
}

export interface PatternMatchResult {
  pattern: string;
  mode: PatternMatchMode;
  candidates: PatternMatchCandidate[];
  scanned: number;
  usedFts: boolean;
}

const JAPANESE_RUN =
  '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々〆ヶ]+?';
const NUMBER_RUN = '[0-9０-９一二三四五六七八九十百千万億兆]+';
const PLACEHOLDER_RE =
  /Dictionary form\+|Number\+|stem\+|N\+|\(period\)|\(frequency\)|Dictionary form|stem|〜|…/giu;

const ORTHOGRAPHIC_VARIANTS: ReadonlyArray<readonly [string, string]> = [
  ['すき', '好き'],
  ['じょうず', '上手'],
  ['へた', '下手'],
  ['いちばん', '一番'],
  ['なかで', '中で'],
  ['あいだに', '間に'],
  ['やむをえず', 'やむを得ず'],
  ['さしつかえない', '差し支えない'],
  ['まかせる', '任せる'],
  ['ごとき', '如き'],
  ['ごとし', '如し'],
  ['かたわら', '傍ら'],
  ['そくして', '即して'],
  ['にたえない', 'に耐えない'],
  ['にたえない', 'に堪えない'],
  ['をよそに', 'を余所に'],
  ['きらいがある', '嫌いがある'],
  ['しまつだ', '始末だ'],
  ['にかたくない', 'に難くない'],
  ['かいもなく', '甲斐もなく'],
  ['ないではすまない', 'ないでは済まない'],
  ['をふまえて', 'を踏まえて'],
  ['をおして', 'を押して'],
  ['にひきかえ', 'に引き換え'],
  ['つうじて', '通じて'],
  ['なにしろ', '何しろ'],
];

const INFLECTIONAL_PATTERN_RULES = new Map([
  [
    '〜なければならない',
    {
      source: `${JAPANESE_RUN}なければ(?:ならない|なりません)`,
      anchor: 'なければ',
    },
  ],
  [
    '〜たり…〜たりする',
    {
      source: `${JAPANESE_RUN}(?:たり|だり)[\\s\\S]*?${JAPANESE_RUN}(?:たり|だり)する`,
      anchor: 'たりする',
    },
  ],
  [
    '〜を余儀なくされる',
    {
      source: `${JAPANESE_RUN}を余儀なくされ(?:る|た|て|ている|ます|ました)`,
      anchor: '余儀なくされ',
    },
  ],
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeJapaneseText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[～∼⁓~]/g, '〜')
    .replace(/下さい/g, 'ください')
    .replace(/\s+/g, '');
}

function placeholderRegex(token: string): string {
  if (/^Number\+$/i.test(token)) return NUMBER_RUN;
  if (token === '…') return '[\\s\\S]*?';
  return JAPANESE_RUN;
}

function splitSlashAlternatives(pattern: string): string[] {
  const alternatives: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '(' || character === '（') depth += 1;
    if (character === ')' || character === '）') depth -= 1;
    if (character === '/' && depth === 0) {
      alternatives.push(pattern.slice(start, index));
      start = index + 1;
    }
  }

  alternatives.push(pattern.slice(start));
  return alternatives.map((item) => item.trim()).filter(Boolean);
}

function lastPlaceholderEnd(value: string): number {
  const placeholders = [
    'Dictionary form+',
    'Number+',
    'stem+',
    'N+',
    '〜',
    '…',
  ];
  let end = 0;

  for (const placeholder of placeholders) {
    const index = value.lastIndexOf(placeholder);
    end = Math.max(end, index < 0 ? 0 : index + placeholder.length);
  }

  return end;
}

function findParenthetical(pattern: string): {
  text: string;
  content: string;
  index: number;
} | null {
  for (const match of pattern.matchAll(/[（(]([^（）()]*)[）)]/gu)) {
    const content = match[1].trim();
    if (/^(period|frequency)$/i.test(content)) continue;
    return {
      text: match[0],
      content,
      index: match.index ?? 0,
    };
  }

  return null;
}

function expandParentheticalVariants(pattern: string): string[] {
  let variants = [pattern];

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    const expanded: string[] = [];

    for (const variant of variants) {
      const group = findParenthetical(variant);
      if (!group) {
        expanded.push(variant);
        continue;
      }

      changed = true;
      const before = variant.slice(0, group.index);
      const after = variant.slice(group.index + group.text.length);
      const base = `${before}${after}`;

      if (/^(は|で)$/.test(group.content)) {
        expanded.push(base, `${before}${group.content}${after}`);
        continue;
      }

      const segmentStart = lastPlaceholderEnd(before);
      const suffix = before.slice(segmentStart);
      if (/\p{Script=Han}/u.test(group.content)) {
        const kanaTail = suffix.match(/[\p{Script=Hiragana}]+$/u)?.[0];
        const orthographic = kanaTail
          ? `${before.slice(0, before.length - kanaTail.length)}${group.content}${after}`
          : `${before.slice(0, segmentStart)}${group.content}${after}`;
        expanded.push(base, orthographic);
        continue;
      }

      if (
        /^[\p{Script=Hiragana}]+$/u.test(group.content) &&
        /\p{Script=Han}/u.test(suffix)
      ) {
        expanded.push(
          base,
          `${before.slice(0, segmentStart)}${group.content}${after}`,
        );
        continue;
      }

      expanded.push(base, `${before}${group.content}${after}`);
    }

    variants = [...new Set(expanded)];
    if (!changed) return variants;
    if (variants.length > 64) {
      throw new Error('O pattern expandiu para combinações demais.');
    }
  }

  throw new Error('Aninhamento de alternativas Tanos excedeu o limite.');
}

function expandOrthographicVariants(patterns: string[]): string[] {
  const variants = new Set(patterns);

  for (const [kana, kanji] of ORTHOGRAPHIC_VARIANTS) {
    for (const variant of [...variants]) {
      if (variant.includes(kana)) variants.add(variant.replaceAll(kana, kanji));
    }
  }

  return [...variants];
}

function compilePatternVariant(pattern: string): {
  regex: RegExp;
  anchors: string[];
} {
  const canonical = canonicalizePattern(pattern).replace(/,〜$/u, '');
  const inflectionalRule = INFLECTIONAL_PATTERN_RULES.get(canonical);
  if (inflectionalRule) {
    return {
      regex: new RegExp(inflectionalRule.source, 'u'),
      anchors: [inflectionalRule.anchor],
    };
  }

  let source = '';
  let cursor = 0;
  const anchors: string[] = [];

  for (const match of canonical.matchAll(PLACEHOLDER_RE)) {
    const token = match[0];
    const position = match.index ?? 0;
    const literal = canonical.slice(cursor, position);
    source += escapeRegExp(literal);
    if (literal) anchors.push(literal);
    source += placeholderRegex(token);
    cursor = position + token.length;
  }

  const trailingLiteral = canonical.slice(cursor);
  source += escapeRegExp(trailingLiteral);
  if (trailingLiteral) anchors.push(trailingLiteral);

  return {
    regex: new RegExp(source, 'u'),
    anchors: anchors.sort((left, right) => right.length - left.length),
  };
}

function compileTanosPattern(pattern: string): {
  regex: RegExp;
  anchors: string[];
} {
  const canonical = canonicalizePattern(pattern);
  const source = canonical === 'いったんーば' ? 'いったん〜ば' : canonical;
  const variants = expandOrthographicVariants(
    splitSlashAlternatives(source).flatMap(expandParentheticalVariants),
  );
  const compiled = variants.map(compilePatternVariant);

  return {
    regex: new RegExp(
      `(?:${compiled.map((variant) => variant.regex.source).join('|')})`,
      'u',
    ),
    anchors: [
      ...new Set(
        compiled.flatMap((variant) =>
          variant.anchors[0] ? [variant.anchors[0]] : [],
        ),
      ),
    ],
  };
}

function searchAnchorVariants(anchor: string): string[] {
  const variants = new Set([anchor]);
  const canonical = normalizeJapaneseText(anchor);
  variants.add(canonical);

  if (canonical.includes('ください')) {
    variants.add(canonical.replace(/ください/g, '下さい'));
  }
  if (canonical.includes('下さい')) {
    variants.add(canonical.replace(/下さい/g, 'ください'));
  }

  return [...variants].filter(Boolean);
}

function quoteFtsPhrase(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function createPatternPredicate(
  pattern: string,
  mode: PatternMatchMode,
): (text: string) => boolean {
  const request = PatternMatchRequestSchema.parse({ pattern, mode, limit: 1 });

  if (request.mode === 'regex') {
    const regex = compileTanosPattern(request.pattern).regex;
    return (text) => regex.test(normalizeJapaneseText(text));
  }

  if (request.mode === 'normalized') {
    const normalizedPattern = normalizeJapaneseText(request.pattern);
    return (text) => normalizeJapaneseText(text).includes(normalizedPattern);
  }

  return (text) => text.includes(request.pattern);
}

export class PatternMatcher {
  private readonly database: InstanceType<typeof Database>;
  private readonly findByFts: Database.Statement<[string], SentenceSearchRow>;
  private readonly scanAll: Database.Statement<[], SentenceSearchRow>;

  constructor(indexPath: string) {
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Índice de frases ausente: ${indexPath}`);
    }

    this.database = new Database(indexPath, {
      readonly: true,
      fileMustExist: true,
    });
    this.findByFts = this.database.prepare(
      'SELECT sentence_id, language, japanese FROM sentence_search WHERE japanese MATCH ? ORDER BY sentence_id',
    );
    this.scanAll = this.database.prepare(
      'SELECT sentence_id, language, japanese FROM sentences ORDER BY sentence_id',
    );
  }

  search(input: {
    pattern: string;
    mode?: PatternMatchMode;
    limit?: number;
  }): PatternMatchResult {
    const request = PatternMatchRequestSchema.parse(input);
    const { anchors } = this.createMatcher(request.pattern, request.mode);
    const matchesPattern = createPatternPredicate(
      request.pattern,
      request.mode,
    );
    const searchAnchors = [...new Set(anchors.flatMap(searchAnchorVariants))];
    const candidates: PatternMatchCandidate[] = [];
    const seenIds = new Set<string>();
    let scanned = 0;
    let usedFts = false;

    const anchorsToSearch = searchAnchors.length > 0 ? searchAnchors : [''];
    for (const anchor of anchorsToSearch) {
      const useFts = Array.from(anchor).length >= 3;
      const rows = useFts
        ? (this.findByFts.iterate(
            quoteFtsPhrase(anchor),
          ) as Iterable<SentenceSearchRow>)
        : (this.scanAll.iterate() as Iterable<SentenceSearchRow>);
      usedFts ||= useFts;

      for (const row of rows) {
        if (seenIds.has(row.sentence_id)) continue;
        seenIds.add(row.sentence_id);
        scanned += 1;

        if (matchesPattern(row.japanese)) {
          candidates.push({
            sentenceId: row.sentence_id,
            language: row.language,
            japanese: row.japanese,
            matchedBy: request.mode,
          });
          if (candidates.length >= request.limit) break;
        }
      }

      if (candidates.length >= request.limit) break;
    }

    return {
      pattern: request.pattern,
      mode: request.mode,
      candidates,
      scanned,
      usedFts,
    };
  }

  close(): void {
    this.database.close();
  }

  private createMatcher(
    pattern: string,
    mode: PatternMatchMode,
  ): { regex: RegExp; anchors: string[] } {
    if (mode === 'regex') return compileTanosPattern(pattern);

    const value =
      mode === 'normalized' ? normalizeJapaneseText(pattern) : pattern;
    return { regex: new RegExp(escapeRegExp(value), 'u'), anchors: [value] };
  }
}
