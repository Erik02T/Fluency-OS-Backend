import type { NormalizedVocabularyEntry, RawVocabularyEntry } from './types';

export function normalizeRawEntries(
  raw: RawVocabularyEntry[],
): NormalizedVocabularyEntry[] {
  const seen = new Map<string, NormalizedVocabularyEntry>();

  for (const entry of raw) {
    const word = normalizeUnicodeAndTrim(entry.word);
    const reading = normalizeUnicodeAndTrim(entry.reading);

    if (!word || !reading) {
      continue;
    }

    const key = `${word}::${reading}`;
    const normalizedMeanings = normalizeMeanings(
      entry.meanings.map((m) => ({
        meaning: m.meaning,
        context: m.context,
      })),
    );

    const combinedPos = combinePartOfSpeech(entry.partOfSpeechTags);
    const selectionScore = calculateSelectionScore(entry);

    const tagList = buildTags(entry);
    const notes = buildNotes(entry);

    const existing = seen.get(key);
    if (existing) {
      existing.meanings = mergeMeanings(existing.meanings, normalizedMeanings);
      existing.selectionScore = Math.max(
        existing.selectionScore,
        selectionScore,
      );
      existing.isCommon = existing.isCommon || entry.isCommon;
    } else {
      seen.set(key, {
        jmdictId: entry.jmdictId,
        word,
        reading,
        meanings: normalizedMeanings,
        partOfSpeech: combinedPos,
        tags: tagList,
        notes,
        selectionScore,
        hasFrequencyInfo: false,
        isCommon: entry.isCommon,
      });
    }
  }

  return Array.from(seen.values());
}

export function normalizeUnicodeAndTrim(value: string): string {
  return value.normalize('NFC').trim();
}

function normalizeMeanings(
  meanings: Array<{ meaning: string; context?: string }>,
): Array<{ meaning: string; context?: string }> {
  const seen = new Map<string, { meaning: string; context?: string }>();

  for (const raw of meanings) {
    const m = normalizeUnicodeAndTrim(raw.meaning).replace(/\s+/g, ' ');
    if (!m) continue;

    const context = raw.context
      ? normalizeUnicodeAndTrim(raw.context)
      : undefined;

    const key = m.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, { meaning: m, context });
    } else if (!seen.get(key)!.context && context) {
      seen.get(key)!.context = context;
    }
  }

  return Array.from(seen.values());
}

function mergeMeanings(
  existing: Array<{ meaning: string; context?: string }>,
  additional: Array<{ meaning: string; context?: string }>,
): Array<{ meaning: string; context?: string }> {
  const map = new Map<string, { meaning: string; context?: string }>();

  for (const m of existing) {
    map.set(m.meaning.toLowerCase(), m);
  }
  for (const m of additional) {
    const key = m.meaning.toLowerCase();
    if (!map.has(key)) {
      map.set(key, m);
    } else if (!map.get(key)!.context && m.context) {
      map.get(key)!.context = m.context;
    }
  }

  return Array.from(map.values()).slice(0, 8);
}

export function calculateSelectionScore(entry: RawVocabularyEntry): number {
  let score = 0;

  if (entry.isCommon) score += 200;
  if (entry.meanings.length >= 1) score += 50;
  if (entry.meanings.length >= 3) score += 30;
  if (entry.partOfSpeechTags.length > 0) score += 20;
  if (/^[\u4e00-\u9faf々]/.test(entry.word)) score += 15;
  if (entry.isRare) score -= 150;
  if (entry.isObscure) score -= 200;
  if (
    entry.fieldTags.some((f) =>
      [
        'med',
        'chem',
        'phys',
        'math',
        'biol',
        'comp',
        'electr',
        'law',
        'mil',
        'stk',
      ].includes(f),
    )
  ) {
    score -= 60;
  }
  if (entry.dialectTags.length > 0 && !entry.dialectTags.includes('hokkaido')) {
    score -= 80;
  }

  return score;
}

function combinePartOfSpeech(posTags: string[]): string | undefined {
  if (posTags.length === 0) return undefined;

  const SIMPLIFIED_POS: Record<string, string> = {
    n: 'noun',
    vs: 'noun (suru verb)',
    v1: 'verb (ichidan)',
    v5u: 'verb (godan)',
    v5k: 'verb (godan)',
    v5s: 'verb (godan)',
    v5t: 'verb (godan)',
    v5n: 'verb (godan)',
    v5m: 'verb (godan)',
    v5r: 'verb (godan)',
    v5w: 'verb (godan)',
    v5g: 'verb (godan)',
    v5z: 'verb (godan)',
    v5b: 'verb (godan)',
    v5p: 'verb (godan)',
    v5aru: 'verb (godan - aru)',
    vk: 'verb (kuru/suru irregular)',
    vi: 'intransitive verb',
    vt: 'transitive verb',
    adji: 'adj-i',
    'adj-i': 'adj-i',
    adjna: 'adj-na',
    'adj-na': 'adj-na',
    adn: 'adnominal',
    adv: 'adverb',
    pn: 'pronoun',
    int: 'interjection',
    conj: 'conjunction',
    prt: 'particle',
    num: 'numeric',
    pref: 'prefix',
    suf: 'suffix',
    aux: 'auxiliary',
    'aux-adj': 'auxiliary adjective',
    'aux-v': 'auxiliary verb',
  };

  const simplified = new Set<string>();
  for (const tag of posTags) {
    const s = SIMPLIFIED_POS[tag];
    if (s) simplified.add(s);
  }

  if (simplified.size === 0) {
    return undefined;
  }

  if (simplified.size === 1) {
    return [...simplified][0];
  }

  const priority = [
    'verb (ichidan)',
    'verb (godan - aru)',
    'verb (godan)',
    'adj-i',
    'adj-na',
    'noun',
    'adverb',
    'particle',
  ];
  for (const p of priority) {
    if (simplified.has(p)) return p;
  }

  return [...simplified][0];
}

function buildTags(entry: RawVocabularyEntry): string[] {
  const tags = new Set<string>();

  if (entry.isCommon) tags.add('common');
  if (entry.isRare) tags.add('rare');

  const USEFUL_FIELD_TAGS = new Set([
    'food',
    'sport',
    'music',
    'bus',
    'train',
    'travel',
    'business',
    'anime',
    'manga',
  ]);
  for (const f of entry.fieldTags) {
    if (USEFUL_FIELD_TAGS.has(f)) tags.add(f);
  }

  return Array.from(tags);
}

function buildNotes(entry: RawVocabularyEntry): string | undefined {
  const parts: string[] = [];
  parts.push('Fonte: JMdict (jmdict-simplified).');
  parts.push('Meanings in English from JMdict gloss entries.');
  if (entry.alternativeReadings && entry.alternativeReadings.length > 0) {
    parts.push(
      `Alternative readings: ${entry.alternativeReadings.slice(0, 3).join('、')}.`,
    );
  }
  return parts.join(' ');
}
