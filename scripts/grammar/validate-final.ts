import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

interface GrammarExample {
  id: string;
  pattern: string;
  jlpt: string;
  position: number;
  source: string;
  reviewStatus: string;
  examples: {
    sourceId: string;
    japanese: string;
    rankingScore: number;
    reviewStatus: string;
    translation: string;
    reading?: string;
  }[];
}

const FinalExampleSchema = z.object({
  sourceId: z.string(),
  japanese: z.string().min(1),
  rankingScore: z.number(),
  reviewStatus: z.literal('VALIDATED'),
  translation: z.string().min(1),
  reading: z.string().min(1),
});

const FinalPatternSchema = z.object({
  id: z.string(),
  pattern: z.string().min(1),
  jlpt: z.string(),
  position: z.number(),
  source: z.string(),
  reviewStatus: z.string(),
  examples: z.array(FinalExampleSchema).min(3).max(5),
});

const FinalDataSchema = z.array(FinalPatternSchema);

interface ValidationError {
  patternId: string;
  sourceId: string;
  field: string;
  error: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    totalPatterns: number;
    totalExamples: number;
    validExamples: number;
    invalidExamples: number;
  };
}

function validateFinal(data: GrammarExample[]): ValidationResult {
  const errors: ValidationError[] = [];

  for (const pattern of data) {
    for (const example of pattern.examples) {
      // Validação 1: japanese vazio
      if (!example.japanese || example.japanese.trim() === '') {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'japanese',
          error: 'japanese vazio',
        });
      }

      // Validação 3: translation vazio
      if (!example.translation || example.translation.trim() === '') {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'translation',
          error: 'translation vazio',
        });
      }

      // Validação 4: reading vazio
      if (!example.reading || example.reading.trim() === '') {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'reading',
          error: 'reading vazio',
        });
      }

      // Validação 5: reviewStatus não é VALIDATED
      if (example.reviewStatus !== 'VALIDATED') {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'reviewStatus',
          error: `reviewStatus deve ser VALIDATED, mas é ${example.reviewStatus}`,
        });
      }

      // Validação 6: translation igual ao japonês
      if (example.translation === example.japanese) {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'translation',
          error: 'translation igual ao japonês',
        });
      }

      // Validação 7: translation muito curta
      if (example.translation.trim().length < 3) {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'translation',
          error: 'translation muito curta',
        });
      }

      // Validação 8: japanese muito curto
      if (example.japanese.trim().length < 2) {
        errors.push({
          patternId: pattern.id,
          sourceId: example.sourceId,
          field: 'japanese',
          error: 'japanese muito curto',
        });
      }
    }
  }

  const totalExamples = data.reduce((sum, p) => sum + p.examples.length, 0);
  const invalidExamples = errors.length;
  const validExamples = totalExamples - invalidExamples;

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalPatterns: data.length,
      totalExamples,
      validExamples,
      invalidExamples,
    },
  };
}

async function main(): Promise<void> {
  const level = process.argv[2] || 'n5';
  console.log(`[FASE 26.7] Validação Final - ${level.toUpperCase()}`);
  console.log('');

  const inputPath = path.join(process.cwd(), 'data', 'validated', `${level}-with-readings.json`);
  const reportPath = path.join(process.cwd(), 'data', 'validated', `${level}-final-report.json`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo com readings não encontrado: ${inputPath}`);
  }

  const data: GrammarExample[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // Validar schema
  try {
    FinalDataSchema.parse(data);
    console.log('✓ Schema validado com sucesso');
  } catch (error) {
    console.error('✗ Erro na validação do schema:', error);
    process.exit(1);
  }

  // Validar conteúdo
  const result = validateFinal(data);

  console.log('\n=== Estatísticas ===');
  console.log(`Total de patterns: ${result.stats.totalPatterns}`);
  console.log(`Total de exemplos: ${result.stats.totalExamples}`);
  console.log(`Exemplos válidos: ${result.stats.validExamples}`);
  console.log(`Exemplos inválidos: ${result.stats.invalidExamples}`);

  if (result.errors.length > 0) {
    console.log('\n=== Erros Encontrados ===');
    for (const error of result.errors.slice(0, 20)) {
      console.log(`  ${error.patternId}/${error.sourceId}: ${error.field} - ${error.error}`);
    }
    if (result.errors.length > 20) {
      console.log(`  ... e mais ${result.errors.length - 20} erros`);
    }
  }

  // Salvar relatório
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  console.log(`\n=== Relatório ===`);
  console.log(`Status: ${result.valid ? 'APROVADO' : 'REPROVADO'}`);
  console.log(`Relatório salvo em: ${reportPath}`);

  if (!result.valid) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[FASE 26.7] Erro:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
