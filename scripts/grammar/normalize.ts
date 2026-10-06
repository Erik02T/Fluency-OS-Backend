/**
 * FASE 3 — Normalização
 * RAW (data/raw/{level}/patterns.json) → CANONICAL (data/normalized/{level}.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  REJECTED_ROOT,
  assertPipelineDirs,
  normalizedFile,
  rawPatternsFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import { normalizeRawPatterns } from './normalize-patterns';
import { RawGrammarPatternListSchema } from './raw-schema';
import { NormalizedGrammarPatternListSchema } from './normalized-schema';

function normalizeLevel(level: JlptLevelDir): {
  accepted: number;
  rejected: number;
} {
  const rawPath = rawPatternsFile(level);
  if (!fs.existsSync(rawPath)) {
    throw new Error(
      `Fonte bruta ausente: ${rawPath}. Execute npm run grammar:extract antes.`,
    );
  }

  const raw = RawGrammarPatternListSchema.parse(
    JSON.parse(fs.readFileSync(rawPath, 'utf8')),
  );

  const { accepted, rejected, issues } = normalizeRawPatterns(raw);
  const validated = NormalizedGrammarPatternListSchema.parse(accepted);

  const outFile = normalizedFile(level);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');

  if (rejected.length > 0) {
    const rejectedFile = path.join(REJECTED_ROOT, `${level}-normalize.json`);
    fs.writeFileSync(
      rejectedFile,
      `${JSON.stringify(rejected, null, 2)}\n`,
      'utf8',
    );
  }

  const jlpt = JLPT_LEVEL_LABEL[level];
  console.log(`✔ ${jlpt}: ${validated.length} padrões normalizados`);

  for (const issue of issues) {
    console.log(`  · [${issue.code}] ${issue.message}`);
  }

  if (rejected.length > 0) {
    console.log(
      `  · rejected: ${rejected.length} → data/rejected/${level}-normalize.json`,
    );
  }

  return { accepted: validated.length, rejected: rejected.length };
}

function main(): void {
  assertPipelineDirs();

  let hardFailures = 0;

  for (const level of JLPT_LEVELS) {
    const result = normalizeLevel(level);
    if (result.accepted === 0) {
      hardFailures += 1;
    }
  }

  if (hardFailures > 0) {
    console.error(
      `[grammar:normalize] Falha: ${hardFailures} nível(is) sem padrões aceitos.`,
    );
    process.exit(1);
  }

  console.log('[grammar:normalize] Concluído.');
}

try {
  main();
} catch (error: unknown) {
  console.error('[grammar:normalize] Erro:', error);
  process.exit(1);
}
