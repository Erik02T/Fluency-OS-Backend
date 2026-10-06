import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  REJECTED_ROOT,
  assertPipelineDirs,
  rawPatternsFile,
  tanosGrammarPdf,
  type JlptLevelDir,
} from '../utils';
import { parseTanosPdfPatterns } from './parse-tanos';
import { validateRawPatterns } from './validate-raw';

const SOURCE = 'tanos';

async function readPdfText(pdfPath: string): Promise<string> {
  const data = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

async function extractLevel(level: JlptLevelDir): Promise<{
  accepted: number;
  rejected: number;
  issues: number;
}> {
  const pdfPath = tanosGrammarPdf(level);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Fonte PDF não encontrada: ${pdfPath}`);
  }

  const text = await readPdfText(pdfPath);
  const jlpt = JLPT_LEVEL_LABEL[level];
  const patterns = parseTanosPdfPatterns(text, jlpt);
  const { accepted, rejected, issues } = validateRawPatterns(
    patterns,
    jlpt,
    SOURCE,
  );

  if (accepted.length === 0) {
    throw new Error(`Nenhum pattern válido extraído para ${jlpt}; saída preservada.`);
  }

  const outFile = rawPatternsFile(level);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(accepted, null, 2)}\n`, 'utf8');

  if (rejected.length > 0) {
    const rejectedFile = path.join(REJECTED_ROOT, `${level}-extract.json`);
    fs.writeFileSync(rejectedFile, `${JSON.stringify(rejected, null, 2)}\n`, 'utf8');
  }

  const mark = issues.some((i) => i.code !== 'DUPLICATE_PATTERN') ? '✖' : '✔';
  console.log(`${mark} ${jlpt}: ${accepted.length} padrões encontrados`);

  for (const issue of issues) {
    console.log(`  · [${issue.code}] ${issue.message}`);
  }

  if (rejected.length > 0) {
    console.log(`  · rejected: ${rejected.length} → data/rejected/${level}-extract.json`);
  }

  return { accepted: accepted.length, rejected: rejected.length, issues: issues.length };
}

async function main(): Promise<void> {
  assertPipelineDirs();

  let hardFailures = 0;

  for (const level of JLPT_LEVELS) {
    const result = await extractLevel(level);
    // Duplicatas são reportadas e rejeitadas; outros erros contam como falha dura
    // (já cobertos por validateRawPatterns ao filtrar accepted).
    if (result.accepted === 0) hardFailures += 1;
  }

  if (hardFailures > 0) {
    console.error(`[grammar:extract] Falha: ${hardFailures} nível(is) sem padrões aceitos.`);
    process.exit(1);
  }

  console.log('[grammar:extract] Concluído.');
}

main().catch((error: unknown) => {
  console.error('[grammar:extract] Erro:', error);
  process.exit(1);
});
