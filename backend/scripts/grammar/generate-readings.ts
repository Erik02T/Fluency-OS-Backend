import fs from 'node:fs';
import path from 'node:path';
import {
  JLPT_LEVEL_LABEL,
  JLPT_LEVELS,
  readingFailuresFile,
  readingsFile,
  selectedExamplesFile,
} from '../utils';
import { JapaneseReadingGenerator } from './reading-generator';
import {
  ReadingFailuresSchema,
  type ReadingFailure,
  type ReadingPattern,
  ReadingPatternsSchema,
  SelectedPatternsForReadingSchema,
} from './reading-schema';

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const generator = new JapaneseReadingGenerator();

  for (const level of JLPT_LEVELS) {
    const selected = SelectedPatternsForReadingSchema.parse(
      JSON.parse(fs.readFileSync(selectedExamplesFile(level), 'utf8')),
    );
    const readings: ReadingPattern[] = [];
    const failures: ReadingFailure[] = [];
    let processedExamples = 0;

    for (const grammarPoint of selected) {
      const examples: ReadingPattern['examples'] = [];
      const failedExamples: ReadingFailure['failedExamples'] = [];

      for (const example of grammarPoint.examples) {
        try {
          const reading = await generator.toHiragana(example.japanese);
          examples.push({ ...example, reading });
          processedExamples += 1;
        } catch (error: unknown) {
          failedExamples.push({
            sourceId: example.sourceId,
            japanese: example.japanese,
            error: getErrorMessage(error),
          });
        }
      }

      if (failedExamples.length > 0) {
        failures.push({
          id: grammarPoint.id,
          pattern: grammarPoint.pattern,
          jlpt: grammarPoint.jlpt,
          failedExamples,
        });
        continue;
      }

      readings.push({ ...grammarPoint, examples });
    }

    const validatedReadings = ReadingPatternsSchema.parse(readings);
    const validatedFailures = ReadingFailuresSchema.parse(failures);
    writeJson(readingsFile(level), validatedReadings);
    writeJson(readingFailuresFile(level), validatedFailures);
    console.log(
      `${JLPT_LEVEL_LABEL[level]}: ${validatedReadings.length} patterns, ${processedExamples} readings${validatedFailures.length > 0 ? `, ${validatedFailures.length} patterns rejeitados` : ''}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error('[grammar:generate-readings] Erro:', error);
  process.exitCode = 1;
});
