import fs from 'node:fs';
import path from 'node:path';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

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
  }[];
}

async function generateReadings(level: string): Promise<void> {
  const validatedPath = path.join(process.cwd(), 'data', 'validated', `${level}.json`);
  const outputPath = path.join(process.cwd(), 'data', 'validated', `${level}-with-readings.json`);

  if (!fs.existsSync(validatedPath)) {
    throw new Error(`Arquivo validado não encontrado: ${validatedPath}`);
  }

  const data: GrammarExample[] = JSON.parse(fs.readFileSync(validatedPath, 'utf8'));

  // Inicializar Kuroshiro com Kuromoji
  const kuroshiro = new Kuroshiro();
  await kuroshiro.init(new KuromojiAnalyzer());

  let totalProcessed = 0;
  let errors = 0;

  for (const pattern of data) {
    for (const example of pattern.examples) {
      try {
        const reading = await kuroshiro.convert(example.japanese, {
          mode: 'spaced',
          to: 'hiragana',
        });
        (example as any).reading = reading;
        totalProcessed++;
      } catch (error) {
        console.error(`Erro ao gerar reading para ${example.sourceId}:`, error);
        (example as any).reading = '';
        errors++;
      }
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`[FASE 26.6] Geração de readings concluída`);
  console.log(`  Total processado: ${totalProcessed}`);
  console.log(`  Erros: ${errors}`);
  console.log(`  Arquivo de saída: ${outputPath}`);
}

async function main(): Promise<void> {
  const level = process.argv[2] || 'n5';
  console.log(`[FASE 26.6] Reading com Kuroshiro/Kuromoji - ${level.toUpperCase()}`);
  console.log('');

  await generateReadings(level);
}

main().catch((error: unknown) => {
  console.error('[FASE 26.6] Erro:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
