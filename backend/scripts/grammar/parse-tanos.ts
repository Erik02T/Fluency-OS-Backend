/**
 * Parser das listas Tanos (GrammarList.N*.pdf).
 * Extrai apenas linhas de padrão — sem inventar conteúdo.
 */

const HEADER_RE =
  /^(JLPT(\s+Resources)?|This is not|Grammar List|Resources|http:\/\/|https:\/\/|www\.)/i;

const NOISE_RE =
  /tanos|cumulative|contain the grammar|needed by JLPT|and below/i;

export function isPatternLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HEADER_RE.test(trimmed)) return false;
  if (NOISE_RE.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) return false;

  // Padrões Tanos: japonês e/ou placeholders em inglês do próprio PDF
  return (
    /[\u3040-\u30ff\u4e00-\u9fff～〜]/.test(trimmed) ||
    /\+/.test(trimmed) ||
    /period/i.test(trimmed) ||
    /Number/i.test(trimmed) ||
    /Dictionary/i.test(trimmed) ||
    /stem/i.test(trimmed)
  );
}

export function parseTanosPatternLines(pdfText: string): string[] {
  const lines = pdfText.split(/\r?\n/);
  const patterns: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!isPatternLine(line)) continue;
    patterns.push(line);
  }

  return patterns;
}

export function parseTanosPdfPatterns(
  pdfText: string,
  expectedJlpt: string,
): string[] {
  const title = new RegExp(`JLPT\\s+${expectedJlpt}\\s+Grammar\\s+List`, 'i');
  if (!title.test(pdfText)) {
    throw new Error(`Título JLPT ${expectedJlpt} ausente ou incorreto no PDF.`);
  }

  const patterns = parseTanosPatternLines(pdfText);
  if (patterns.length === 0) {
    throw new Error(`Nenhum pattern extraído do PDF JLPT ${expectedJlpt}.`);
  }

  return patterns;
}
