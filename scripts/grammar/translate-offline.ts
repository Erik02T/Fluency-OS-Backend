import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import { z } from 'zod';

// Tipos de status
export type TranslationStatus = 'PENDING' | 'TRANSLATED' | 'VALIDATED' | 'REJECTED';

// Schema para o exemplo de entrada (de data/examples)
const GrammarExampleSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  jlpt: z.string(),
  position: z.number(),
  source: z.string(),
  reviewStatus: z.enum(['PENDING', 'TRANSLATED', 'VALIDATED', 'REJECTED']),
  examples: z.array(
    z.object({
      sourceId: z.string(),
      japanese: z.string(),
      rankingScore: z.number(),
      reviewStatus: z.enum(['PENDING', 'TRANSLATED', 'VALIDATED', 'REJECTED']),
    }),
  ),
});

const GrammarExampleInputSchema = z.array(GrammarExampleSchema);

// Schema para o exemplo traduzido (data/translated)
const GrammarExampleTranslatedItemSchema = GrammarExampleSchema.extend({
  examples: z.array(
    z.object({
      sourceId: z.string(),
      japanese: z.string(),
      rankingScore: z.number(),
      reviewStatus: z.enum(['PENDING', 'TRANSLATED', 'VALIDATED', 'REJECTED']),
      translation: z.string().optional(),
    }),
  ),
});

const GrammarExampleTranslatedSchema = z.array(GrammarExampleTranslatedItemSchema);

// Schema para o exemplo validado (data/validated)
const GrammarExampleValidatedItemSchema = GrammarExampleSchema.extend({
  examples: z.array(
    z.object({
      sourceId: z.string(),
      japanese: z.string(),
      rankingScore: z.number(),
      reviewStatus: z.literal('VALIDATED'),
      translation: z.string(),
    }),
  ),
});

const GrammarExampleValidatedSchema = z.array(GrammarExampleValidatedItemSchema);

type GrammarExampleInput = z.infer<typeof GrammarExampleInputSchema>;
type GrammarExampleTranslated = z.infer<typeof GrammarExampleTranslatedSchema>;
type GrammarExampleValidated = z.infer<typeof GrammarExampleValidatedSchema>;
type GrammarExampleItem = z.infer<typeof GrammarExampleSchema>;

interface CliOptions {
  level?: string;
  batch?: number;
  action?: 'prepare' | 'translate' | 'validate' | 'status';
}

function parseCliOptions(argv: string[]): CliOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      level: { type: 'string' },
      batch: { type: 'string' },
      action: { type: 'string' },
    },
    strict: true,
  });

  if (values.batch !== undefined) {
    const batchNum = Number(values.batch);
    if (!Number.isInteger(batchNum) || batchNum < 1) {
      throw new Error('--batch deve ser inteiro >= 1');
    }
  }

  if (values.action !== undefined) {
    if (!['prepare', 'translate', 'validate', 'status'].includes(values.action)) {
      throw new Error('--action deve ser: prepare, translate, validate ou status');
    }
  }

  return {
    level: values.level,
    batch: values.batch === undefined ? undefined : Number(values.batch),
    action: values.action as CliOptions['action'] | undefined,
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

// Configuração de lotes
const BATCH_SIZE = 10; // 10 patterns por lote

function getBatch(items: unknown[], batchNumber: number): unknown[] {
  const start = (batchNumber - 1) * BATCH_SIZE;
  const end = start + BATCH_SIZE;
  return items.slice(start, end);
}

// Preparar arquivo de tradução a partir de examples
function prepareTranslationFile(level: string): void {
  const examplesPath = path.join(process.cwd(), 'data', 'examples', `${level}.json`);
  const translatedPath = path.join(process.cwd(), 'data', 'translated', `${level}.json`);

  if (!fs.existsSync(examplesPath)) {
    throw new Error(`Arquivo de exemplos não encontrado: ${examplesPath}`);
  }

  const examples = GrammarExampleInputSchema.parse(
    JSON.parse(fs.readFileSync(examplesPath, 'utf8')),
  );

  // Adicionar campo translation vazio a cada exemplo
  const translated = examples.map((pattern) => ({
    ...pattern,
    examples: pattern.examples.map((example) => ({
      ...example,
      translation: undefined,
      reviewStatus: 'PENDING' as const,
    })),
  }));

  writeJson(translatedPath, translated);
  console.log(`[FASE 26.5] Arquivo de tradução preparado: ${translatedPath}`);
  console.log(`[FASE 26.5] Total de patterns: ${translated.length}`);
  console.log(`[FASE 26.5] Total de exemplos: ${translated.reduce((sum, p) => sum + p.examples.length, 0)}`);
}

// Validar traduções
function validateTranslation(example: GrammarExampleItem): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const ex of example.examples) {
    const translation = (ex as any).translation;
    // Validação 1: translation vazio
    if (!translation || translation.trim() === '') {
      errors.push(`sourceId ${ex.sourceId}: translation vazio`);
      continue;
    }

    // Validação 2: japanese vazio
    if (!ex.japanese || ex.japanese.trim() === '') {
      errors.push(`sourceId ${ex.sourceId}: japanese vazio`);
    }

    // Validação 3: translation igual ao japonês
    if (translation === ex.japanese) {
      errors.push(`sourceId ${ex.sourceId}: translation igual ao japonês (REVIEW)`);
    }

    // Validação 4: translation contém instruções
    if (/traduza|translate|traduzir|请翻译/i.test(translation)) {
      errors.push(`sourceId ${ex.sourceId}: translation contém instruções (REVIEW)`);
    }

    // Validação 5: translation muito curta (< 3 caracteres)
    if (translation.trim().length < 3) {
      errors.push(`sourceId ${ex.sourceId}: translation muito curta`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Mostrar status atual
function showStatus(level: string): void {
  const translatedPath = path.join(process.cwd(), 'data', 'translated', `${level}.json`);

  if (!fs.existsSync(translatedPath)) {
    console.log(`[FASE 26.5] Arquivo de tradução não encontrado: ${translatedPath}`);
    console.log('[FASE 26.5] Execute --action prepare primeiro');
    return;
  }

  const translated = GrammarExampleTranslatedSchema.parse(
    JSON.parse(fs.readFileSync(translatedPath, 'utf8')),
  );

  let totalExamples = 0;
  let pending = 0;
  let translatedCount = 0;
  let validated = 0;
  let rejected = 0;

  for (const pattern of translated) {
    for (const example of pattern.examples) {
      totalExamples++;
      switch (example.reviewStatus) {
        case 'PENDING':
          pending++;
          break;
        case 'TRANSLATED':
          translatedCount++;
          break;
        case 'VALIDATED':
          validated++;
          break;
        case 'REJECTED':
          rejected++;
          break;
      }
    }
  }

  console.log(`[FASE 26.5] Status - ${level.toUpperCase()}`);
  console.log(`  Total de exemplos: ${totalExamples}`);
  console.log(`  PENDENTE: ${pending}`);
  console.log(`  TRADUZIDO: ${translatedCount}`);
  console.log(`  VALIDADO: ${validated}`);
  console.log(`  REJEITADO: ${rejected}`);
  console.log(`  Padrões: ${translated.length}`);
}

// Traduzir um lote específico
function translateBatch(level: string, batchNumber: number): void {
  const translatedPath = path.join(process.cwd(), 'data', 'translated', `${level}.json`);

  if (!fs.existsSync(translatedPath)) {
    throw new Error(`Arquivo de tradução não encontrado: ${translatedPath}`);
  }

  const translated = GrammarExampleTranslatedSchema.parse(
    JSON.parse(fs.readFileSync(translatedPath, 'utf8')),
  );

  const batch = getBatch(translated, batchNumber);

  if (batch.length === 0) {
    console.log(`[FASE 26.5] Lote ${batchNumber} vazio ou fora do range`);
    return;
  }

  console.log(`[FASE 26.5] Lote ${batchNumber}: ${batch.length} patterns`);
  console.log(`[FASE 26.5] Total de exemplos neste lote: ${batch.reduce((sum, p: any) => sum + p.examples.length, 0)}`);
  console.log('');
  console.log('=== EXEMPLOS PARA TRADUZIR ===');
  console.log('');

  let exampleIndex = 1;
  for (const pattern of batch as GrammarExampleItem[]) {
    console.log(`Pattern: ${pattern.pattern} (${pattern.id})`);
    for (const example of pattern.examples) {
      const translation = (example as any).translation;
      if (example.reviewStatus === 'PENDING' || !translation) {
        console.log(`  [${exampleIndex}] sourceId: ${example.sourceId}`);
        console.log(`      Japonês: ${example.japanese}`);
        console.log(`      Tradução: [PENDENTE - preencher manualmente]`);
        console.log('');
        exampleIndex++;
      }
    }
  }

  console.log('');
  console.log(`[FASE 26.5] Edite o arquivo ${translatedPath} e preencha as traduções para os exemplos PENDENTE.`);
  console.log(`[FASE 26.5] Após preencher, execute --action validate para validar.`);
}

// Validar todas as traduções
function validateAll(level: string): void {
  const translatedPath = path.join(process.cwd(), 'data', 'translated', `${level}.json`);
  const validatedPath = path.join(process.cwd(), 'data', 'validated', `${level}.json`);

  if (!fs.existsSync(translatedPath)) {
    throw new Error(`Arquivo de tradução não encontrado: ${translatedPath}`);
  }

  const translated = GrammarExampleTranslatedSchema.parse(
    JSON.parse(fs.readFileSync(translatedPath, 'utf8')),
  );

  const validated: GrammarExampleValidated = [];
  const rejected: { patternId: string; sourceId: string; japanese: string; errors: string[] }[] = [];
  let totalValidated = 0;
  let totalRejected = 0;

  for (const pattern of translated) {
    const validation = validateTranslation(pattern);

    if (validation.valid) {
      // Marcar todos como VALIDADOS
      const validatedPattern = {
        ...pattern,
        examples: pattern.examples.map((ex) => ({
          ...ex,
          reviewStatus: 'VALIDATED' as const,
          translation: (ex as any).translation || '',
        })),
      };
      validated.push(validatedPattern);
      totalValidated += pattern.examples.length;
    } else {
      // Adicionar aos rejeitados
      for (const error of validation.errors) {
        const match = error.match(/sourceId (\d+): (.+)/);
        if (match) {
          const sourceId = match[1];
          const errorMsg = match[2];
          const example = pattern.examples.find((ex) => ex.sourceId === sourceId);
          if (example) {
            rejected.push({
              patternId: pattern.id,
              sourceId,
              japanese: example.japanese,
              errors: [errorMsg],
            });
            totalRejected++;
          }
        }
      }
    }
  }

  // Salvar arquivo validado
  writeJson(validatedPath, validated);

  // Salvar relatório de rejeitados
  const rejectedPath = path.join(process.cwd(), 'data', 'validated', `${level}-rejected.json`);
  writeJson(rejectedPath, rejected);

  console.log(`[FASE 26.5] Validação concluída`);
  console.log(`  Validados: ${totalValidated}`);
  console.log(`  Rejeitados: ${totalRejected}`);
  console.log(`  Arquivo validado: ${validatedPath}`);
  console.log(`  Arquivo rejeitados: ${rejectedPath}`);
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const level = options.level || 'n5';

  console.log(`[FASE 26.5] Tradução Offline - ${level.toUpperCase()}`);
  console.log('');

  const action = options.action || 'status';

  switch (action) {
    case 'prepare':
      prepareTranslationFile(level);
      break;
    case 'translate':
      if (!options.batch) {
        throw new Error('--batch é obrigatório para action=translate');
      }
      translateBatch(level, options.batch);
      break;
    case 'validate':
      validateAll(level);
      break;
    case 'status':
      showStatus(level);
      break;
  }
}

main().catch((error: unknown) => {
  console.error('[FASE 26.5] Erro:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
