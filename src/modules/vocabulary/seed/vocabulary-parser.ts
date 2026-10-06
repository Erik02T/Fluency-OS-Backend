import type {
  JMdict,
  JMdictSense,
  JMdictWord,
} from '@scriptin/jmdict-simplified-types';
import type { RawVocabularyEntry } from './types';

const RARE_MISC_TAGS = new Set([
  'rare',
  'obscure',
  'archaic',
  'dated',
  'historical',
  'humble',
  'ken',
  'kigo',
  'obsolete',
]);
const NAME_PART_OF_SPEECH = new Set([
  'surname',
  'place',
  'given',
  'name',
  'person',
  'company',
  'product',
  'organization',
  'station',
  'work',
]);
const JMDICT_PRIORITY_SCORE: Record<string, number> = {
  news1: 100,
  news2: 50,
  ichi1: 80,
  ichi2: 40,
  spec1: 90,
  spec2: 45,
  gai1: 70,
  gai2: 35,
};

export function parseJmdictDictionary(jmdict: JMdict): RawVocabularyEntry[] {
  const results: RawVocabularyEntry[] = [];
  const seenKeys = new Set<string>();

  for (const word of jmdict.words) {
    const entries = parseJmdictWord(word);
    for (const entry of entries) {
      const key = `${entry.word}::${entry.reading}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(entry);
      }
    }
  }

  return results;
}

export function parseJmdictWord(word: JMdictWord): RawVocabularyEntry[] {
  if (isNameEntry(word)) {
    return [];
  }

  const allPartOfSpeech = extractAllPartOfSpeech(word.sense);
  const allFieldTags = extractAllFieldTags(word.sense);
  const allDialectTags = extractAllDialectTags(word.sense);
  const hasRareMarker = hasRareMisc(word.sense);
  const isObscure = hasObscureMarker(word);
  const isCommon = isWordCommon(word);

  const englishGlosses = extractEnglishGlosses(word.sense);

  if (englishGlosses.length === 0) {
    return [];
  }

  if (word.kanji.length === 0 && word.kana.length > 0) {
    return word.kana.map((kana, idx) => ({
      jmdictId: `${word.id}-k${idx}`,
      word: kana.text,
      reading: kana.text,
      alternativeReadings: word.kana
        .slice(0, 5)
        .filter((k) => k.text !== kana.text)
        .map((k) => k.text),
      meanings: englishGlosses,
      partOfSpeechTags: allPartOfSpeech,
      isCommon: isCommon || kana.common,
      isRare: hasRareMarker,
      isObscure,
      fieldTags: allFieldTags,
      dialectTags: allDialectTags,
      _score: 0,
    }));
  }

  const results: RawVocabularyEntry[] = [];

  for (let ki = 0; ki < word.kanji.length; ki++) {
    const kanji = word.kanji[ki];
    const applicableKanas = word.kana.filter((kana) => {
      if (kana.appliesToKanji.length === 0) return false;
      if (kana.appliesToKanji.includes('*')) return true;
      return kana.appliesToKanji.includes(kanji.text);
    });

    const selectedKanas =
      applicableKanas.length > 0
        ? applicableKanas
        : [word.kana[0]].filter(Boolean);

    for (let kri = 0; kri < selectedKanas.length; kri++) {
      const kana = selectedKanas[kri];
      results.push({
        jmdictId: `${word.id}-${ki}-${kri}`,
        word: kanji.text,
        reading: kana.text,
        alternativeReadings: selectedKanas
          .filter((k) => k.text !== kana.text)
          .slice(0, 4)
          .map((k) => k.text),
        meanings: englishGlosses,
        partOfSpeechTags: allPartOfSpeech,
        isCommon: isCommon || kanji.common || kana.common,
        isRare: hasRareMarker,
        isObscure,
        fieldTags: allFieldTags,
        dialectTags: allDialectTags,
      });
    }
  }

  return results;
}

export function isNameEntry(word: JMdictWord): boolean {
  const namePos = word.sense.some((s) =>
    s.partOfSpeech.some((p) => NAME_PART_OF_SPEECH.has(p)),
  );
  if (namePos) return true;

  const allKanjis = word.kanji.flatMap((k) => k.tags).join(' ');
  const allKanas = word.kana.flatMap((k) => k.tags).join(' ');
  const combined = `${allKanjis} ${allKanas}`;

  return NAME_PART_OF_SPEECH.has(combined) ? false : false;
}

function extractAllPartOfSpeech(senses: JMdictSense[]): string[] {
  const set = new Set<string>();
  for (const s of senses) {
    for (const pos of s.partOfSpeech) {
      set.add(pos);
    }
  }
  return Array.from(set);
}

function extractAllFieldTags(senses: JMdictSense[]): string[] {
  const set = new Set<string>();
  for (const s of senses) {
    for (const f of s.field) {
      set.add(f);
    }
  }
  return Array.from(set);
}

function extractAllDialectTags(senses: JMdictSense[]): string[] {
  const set = new Set<string>();
  for (const s of senses) {
    for (const d of s.dialect) {
      set.add(d);
    }
  }
  return Array.from(set);
}

function hasRareMisc(senses: JMdictSense[]): boolean {
  return senses.some((s) => s.misc.some((m) => RARE_MISC_TAGS.has(m)));
}

function hasObscureMarker(word: JMdictWord): boolean {
  const kanjiText = word.kanji.map((k) => k.text).join(' ');
  return /々|仝|〇|〆|＊|×/.test(kanjiText);
}

function isWordCommon(word: JMdictWord): boolean {
  if (word.kanji.some((k) => k.common)) return true;
  if (word.kana.some((k) => k.common)) return true;

  const priorityScore = calcPriorityScore(word);
  return priorityScore > 0;
}

export function calcPriorityScore(word: JMdictWord): number {
  let score = 0;
  for (const k of word.kanji) {
    for (const t of k.tags) {
      score += JMDICT_PRIORITY_SCORE[t] ?? 0;
    }
  }
  for (const k of word.kana) {
    for (const t of k.tags) {
      score += JMDICT_PRIORITY_SCORE[t] ?? 0;
    }
  }
  return score;
}

function extractEnglishGlosses(
  senses: JMdictSense[],
): Array<{ meaning: string; context?: string; language: string }> {
  const out: Array<{ meaning: string; context?: string; language: string }> =
    [];
  const seen = new Set<string>();

  for (const sense of senses) {
    const enGlosses = sense.gloss.filter(
      (g) => g.lang === 'eng' || g.lang.startsWith('en'),
    );
    const context =
      sense.field.length > 0 ? sense.field.slice(0, 2).join(', ') : undefined;

    for (const gloss of enGlosses) {
      const text = gloss.text.trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      out.push({
        meaning: text,
        context,
        language: 'eng',
      });
    }
  }

  if (out.length === 0) {
    for (const sense of senses) {
      for (const gloss of sense.gloss) {
        const text = gloss.text.trim();
        if (!text || seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        out.push({
          meaning: text,
          context: undefined,
          language: gloss.lang,
        });
      }
    }
  }

  return out.slice(0, 8);
}
