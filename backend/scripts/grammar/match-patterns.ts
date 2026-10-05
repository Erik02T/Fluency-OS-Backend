import { parseArgs } from 'node:util';
import { SENTENCE_INDEX_FILE } from '../utils';
import {
  PatternMatchModeSchema,
  PatternMatcher,
} from './pattern-matcher';

function main(): void {
  const { values } = parseArgs({
    options: {
      pattern: { type: 'string', short: 'p' },
      mode: { type: 'string', short: 'm' },
      limit: { type: 'string', short: 'l' },
    },
  });

  if (!values.pattern) {
    throw new Error(
      'Informe --pattern. Uso: npm run grammar:match -- --pattern "〜なければならない" --mode regex --limit 20',
    );
  }

  const mode = PatternMatchModeSchema.parse(values.mode ?? 'regex');
  const matcher = new PatternMatcher(SENTENCE_INDEX_FILE);

  try {
    const result = matcher.search({
      pattern: values.pattern,
      mode,
      limit: values.limit === undefined ? 20 : Number(values.limit),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    matcher.close();
  }
}

try {
  main();
} catch (error: unknown) {
  console.error('[grammar:match] Erro:', error);
  process.exitCode = 1;
}