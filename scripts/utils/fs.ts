import fs from 'node:fs';
import {
  GENERATED_ROOT,
  JLPT_LEVELS,
  NORMALIZED_ROOT,
  RAW_ROOT,
  REJECTED_GRAMMAR_ROOT,
  REJECTED_ROOT,
  SEED_GRAMMAR_ROOT,
  VALIDATED_GRAMMAR_ROOT,
  VALIDATED_ROOT,
  rawLevelDir,
} from './paths';

/**
 * Garante que a estrutura de pastas do pipeline existe (reproduzível no VS Code).
 */
export function assertPipelineDirs(): string[] {
  const required = [
    RAW_ROOT,
    ...JLPT_LEVELS.map((level) => rawLevelDir(level)),
    NORMALIZED_ROOT,
    GENERATED_ROOT,
    VALIDATED_ROOT,
    VALIDATED_GRAMMAR_ROOT,
    REJECTED_ROOT,
    REJECTED_GRAMMAR_ROOT,
    SEED_GRAMMAR_ROOT,
  ];

  for (const dir of required) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return required;
}
