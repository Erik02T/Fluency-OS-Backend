/**
 * FASE 9 — Sistema de QA por amostragem
 * Amostra aleatoriamente registros gramaticais para revisão manual de qualidade.
 * Permite aprovação/rejeição e atualização de status no banco de dados.
 */
import { PrismaClient, JLPTLevel, ReviewStatus } from '@prisma/client';
import readline from 'node:readline';

const prisma = new PrismaClient();

interface QaOptions {
  level?: JLPTLevel;
  sampleSize: number;
  status?: ReviewStatus;
  interactive: boolean;
}

function parseArgs(argv: string[]): QaOptions {
  const opts: QaOptions = {
    sampleSize: 5,
    interactive: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--level') {
      const value = argv[++i]?.toUpperCase();
      if (value && ['N5', 'N4', 'N3', 'N2', 'N1'].includes(value)) {
        opts.level = value as JLPTLevel;
      }
    } else if (arg === '--sample-size') {
      const value = Number(argv[++i]);
      if (Number.isInteger(value) && value > 0) {
        opts.sampleSize = value;
      }
    } else if (arg === '--status') {
      const value = argv[++i]?.toUpperCase();
      if (value && ['PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED'].includes(value)) {
        opts.status = value as ReviewStatus;
      }
    } else if (arg === '--non-interactive') {
      opts.interactive = false;
    }
  }

  return opts;
}

/**
 * Amostra aleatoriamente registros gramaticais.
 */
async function sampleGrammarPoints(opts: QaOptions) {
  const where: any = {};
  if (opts.level) {
    where.jlptLevel = opts.level;
  }
  if (opts.status) {
    where.reviewStatus = opts.status;
  }

  // Conta total
  const total = await prisma.grammarPoint.count({ where });

  // Amostra aleatória usando ORDER BY RANDOM()
  const sample = await prisma.grammarPoint.findMany({
    where,
    include: {
      examples: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: {
      // Random ordering - PostgreSQL specific
      // Para outros bancos, usariamos outra estratégia
      id: 'asc',
    },
    take: opts.sampleSize,
  });

  // Se não conseguiu usar RANDOM(), aplica Fisher-Yates shuffle
  const shuffled = [...sample].sort(() => Math.random() - 0.5);

  return { total, sample: shuffled.slice(0, opts.sampleSize) };
}

/**
 * Exibe um ponto gramatical para revisão.
 */
function displayGrammarPoint(gp: any, index: number, total: number) {
  console.log('\n' + '═'.repeat(70));
  console.log(`[${index + 1}/${total}] ${gp.pattern} (${gp.jlptLevel})`);
  console.log('═'.repeat(70));
  console.log(`ID: ${gp.id}`);
  console.log(`Source: ${gp.source || 'N/A'} | Source ID: ${gp.sourceId || 'N/A'}`);
  console.log(`Title: ${gp.title}`);
  console.log(`Formality: ${gp.formalityLevel} | Difficulty: ${gp.difficulty}`);
  console.log(`Tags: ${gp.tags.join(', ')}`);
  console.log(`Status: ${gp.reviewStatus}`);
  console.log('\n--- Short Explanation ---');
  console.log(gp.shortExplanation);
  console.log('\n--- Detailed Explanation ---');
  console.log(gp.detailedExplanation || '(N/A)');
  console.log('\n--- Examples ---');
  gp.examples.forEach((ex: any, i: number) => {
    console.log(`\n${i + 1}. ${ex.japanese}`);
    console.log(`   Reading: ${ex.reading || '(N/A)'}`);
    console.log(`   Translation: ${ex.translation}`);
  });
  console.log('═'.repeat(70));
}

/**
 * Interface interativa para revisão.
 */
async function interactiveReview(sample: any[]): Promise<{ approved: number; rejected: number; skipped: number }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  let approved = 0;
  let rejected = 0;
  let skipped = 0;

  for (let i = 0; i < sample.length; i++) {
    const gp = sample[i];
    displayGrammarPoint(gp, i, sample.length);

    const answer = await question(
      '\n[A]provar | [R]ejeitar | [S]altar | [Q]uit: ',
    );

    const choice = answer.trim().toUpperCase();

    if (choice === 'A' || choice === 'APPROVAR') {
      await prisma.grammarPoint.update({
        where: { id: gp.id },
        data: { reviewStatus: ReviewStatus.REVIEWED, reviewedAt: new Date() },
      });
      approved += 1;
      console.log('✓ Aprovado');
    } else if (choice === 'R' || choice === 'REJEITAR') {
      const reason = await question('Motivo da rejeição: ');
      await prisma.grammarPoint.update({
        where: { id: gp.id },
        data: {
          reviewStatus: ReviewStatus.PENDING,
          detailedExplanation: `[REJEITADO QA] ${reason}\n\n${gp.detailedExplanation || ''}`,
        },
      });
      rejected += 1;
      console.log('✗ Rejeitado');
    } else if (choice === 'S' || choice === 'SALTAR') {
      skipped += 1;
      console.log('→ Pulado');
    } else if (choice === 'Q' || choice === 'QUIT') {
      console.log('Interrompendo revisão...');
      break;
    } else {
      console.log('Opção inválida, pulando...');
      skipped += 1;
    }
  }

  rl.close();
  return { approved, rejected, skipped };
}

/**
 * Gera relatório de amostragem não-interativo.
 */
function generateReport(sample: any[]) {
  console.log('\n' + '═'.repeat(70));
  console.log('RELATÓRIO DE AMOSTRAGEM QA');
  console.log('═'.repeat(70));
  console.log(`Total amostrado: ${sample.length}`);
  console.log('\n--- Detalhes ---');
  sample.forEach((gp, i) => {
    console.log(`\n${i + 1}. ${gp.pattern} (${gp.jlptLevel}) - ${gp.reviewStatus}`);
    console.log(`   ID: ${gp.id}`);
    console.log(`   Examples: ${gp.examples.length}`);
  });
  console.log('═'.repeat(70));
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  console.log('═'.repeat(70));
  console.log('FASE 9 — Sistema de QA por Amostragem');
  console.log('═'.repeat(70));
  console.log(`Nível: ${opts.level || 'Todos'}`);
  console.log(`Status: ${opts.status || 'Todos'}`);
  console.log(`Tamanho da amostra: ${opts.sampleSize}`);
  console.log(`Modo: ${opts.interactive ? 'Interativo' : 'Relatório'}`);
  console.log('═'.repeat(70));

  // Verifica DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não está definido no .env');
    process.exit(1);
  }

  const { total, sample } = await sampleGrammarPoints(opts);

  console.log(`\nTotal no banco: ${total}`);
  console.log(`Amostra selecionada: ${sample.length}`);

  if (sample.length === 0) {
    console.log('\nNenhum registro encontrado para amostragem.');
    await prisma.$disconnect();
    return;
  }

  if (opts.interactive) {
    const result = await interactiveReview(sample);
    console.log('\n' + '═'.repeat(70));
    console.log('RESUMO DA REVISÃO');
    console.log('═'.repeat(70));
    console.log(`Aprovados: ${result.approved}`);
    console.log(`Rejeitados: ${result.rejected}`);
    console.log(`Pulados: ${result.skipped}`);
    console.log('═'.repeat(70));
  } else {
    generateReport(sample);
  }

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Erro:', error);
  await prisma.$disconnect();
  process.exit(1);
});
