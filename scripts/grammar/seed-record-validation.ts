/**
 * Contrato estrutural dos registros em seed/grammar/{n5..n1}.json.
 *
 * Usado por:
 *   - FASE 28 (validate-complete.ts) — produção de data/validated/grammar
 *   - testes de ambiente do pipeline
 *
 * Um arquivo de seed pode estar vazio (bootstrap) ou preenchido pelo
 * structure-grammar-points. Quando preenchido, cada registro precisa
 * satisfazer estas regras antes do seed no banco.
 */

export interface GrammarExampleRecord {
  japanese: string;
  reading?: string;
  translation?: string;
  sourceId?: string;
  position?: number;
  rankingScore?: number;
  reviewStatus?: string;
  [key: string]: unknown;
}

export interface GrammarSeedRecord {
  id: string;
  pattern: string;
  jlpt: string;
  position: number;
  source?: string;
  sourceId?: string;
  title?: string;
  shortExplanation?: string;
  detailedExplanation?: string;
  formalityLevel?: string;
  difficulty?: number;
  tags?: string[];
  reviewStatus?: string;
  examples: GrammarExampleRecord[];
  [key: string]: unknown;
}

export interface RejectedSeedRecord {
  record: GrammarSeedRecord;
  reasons: string[];
  rejectedAt: string;
}

export interface SeedDatasetValidationResult {
  total: number;
  valid: GrammarSeedRecord[];
  rejected: RejectedSeedRecord[];
  reasons: Record<string, number>;
}

export const VALID_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type ValidJlpt = (typeof VALID_JLPT)[number];

export function isValidJlpt(value: string): value is ValidJlpt {
  return (VALID_JLPT as readonly string[]).includes(value);
}

export function normalizeJapaneseText(value: string): string {
  return value.normalize('NFC').trim();
}

export function normalizeRecord(record: GrammarSeedRecord): GrammarSeedRecord {
  const normalizedExamples = Array.isArray(record.examples)
    ? record.examples.map((ex) => ({
        ...ex,
        japanese: ex.japanese ? normalizeJapaneseText(ex.japanese) : '',
        reading: ex.reading ? normalizeJapaneseText(ex.reading) : undefined,
        translation:
          typeof ex.translation === 'string' ? ex.translation.trim() : ex.translation,
      }))
    : record.examples;

  return {
    ...record,
    pattern: record.pattern ? normalizeJapaneseText(record.pattern) : '',
    jlpt: record.jlpt ? record.jlpt.trim().toUpperCase() : '',
    examples: normalizedExamples,
  };
}

/**
 * Valida um único GrammarPoint + examples.
 * Quando `expectedJlpt` é informado, exige que o registro pertença ao nível do arquivo.
 */
export function validateSeedRecord(
  record: GrammarSeedRecord,
  seenPatterns: Set<string>,
  seenIds: Set<string>,
  expectedJlpt?: ValidJlpt,
): string[] {
  const reasons: string[] = [];

  if (!record.id || String(record.id).trim() === '') {
    reasons.push('id vazio');
  } else if (seenIds.has(record.id)) {
    reasons.push('duplicação de id');
  }

  if (!record.pattern || record.pattern.trim() === '') {
    reasons.push('pattern vazio');
  } else if (seenPatterns.has(record.pattern)) {
    reasons.push('duplicação de pattern');
  }

  if (!record.jlpt || record.jlpt.trim() === '') {
    reasons.push('jlpt vazio');
  } else if (!isValidJlpt(record.jlpt)) {
    reasons.push(`JLPT inválido (${record.jlpt})`);
  } else if (expectedJlpt && record.jlpt !== expectedJlpt) {
    reasons.push(`JLPT do registro (${record.jlpt}) difere do nível do arquivo (${expectedJlpt})`);
  }

  if (record.position == null || Number.isNaN(record.position)) {
    reasons.push('position ausente');
  } else if (!Number.isInteger(record.position) || record.position < 1) {
    reasons.push('position inválido (deve ser inteiro >= 1)');
  }

  if (!record.examples || !Array.isArray(record.examples)) {
    reasons.push('examples ausente ou não é array');
  } else if (record.examples.length === 0) {
    reasons.push('example vazio (sem exemplos)');
  } else {
    record.examples.forEach((ex, idx) => {
      const prefix = `exemplo[${idx}]`;
      if (!ex.japanese || ex.japanese.trim() === '') {
        reasons.push(`${prefix}: japanese vazio`);
      }
      if (!ex.reading || ex.reading.trim() === '') {
        reasons.push(`${prefix}: reading vazio`);
      }
      if (!ex.sourceId || String(ex.sourceId).trim() === '') {
        reasons.push(`${prefix}: sourceId inexistente`);
      }
    });
  }

  return reasons;
}

/** Valida um dataset completo de seed (array JSON de um nível). */
export function validateSeedDataset(
  rawData: unknown,
  expectedJlpt?: ValidJlpt,
): SeedDatasetValidationResult {
  if (!Array.isArray(rawData)) {
    return {
      total: 0,
      valid: [],
      rejected: [
        {
          record: {
            id: '',
            pattern: '',
            jlpt: expectedJlpt ?? '',
            position: 0,
            examples: [],
          },
          reasons: ['dataset não é um array JSON'],
          rejectedAt: new Date().toISOString(),
        },
      ],
      reasons: { 'dataset não é um array JSON': 1 },
    };
  }

  const valid: GrammarSeedRecord[] = [];
  const rejected: RejectedSeedRecord[] = [];
  const seenPatterns = new Set<string>();
  const seenIds = new Set<string>();
  const reasons: Record<string, number> = {};
  const now = new Date().toISOString();

  for (const raw of rawData as GrammarSeedRecord[]) {
    const record = normalizeRecord(raw);
    const recordReasons = validateSeedRecord(
      record,
      seenPatterns,
      seenIds,
      expectedJlpt,
    );

    if (record.id) seenIds.add(record.id);
    if (record.pattern) seenPatterns.add(record.pattern);

    if (recordReasons.length === 0) {
      valid.push(record);
    } else {
      rejected.push({ record, reasons: recordReasons, rejectedAt: now });
      for (const reason of recordReasons) {
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
  }

  return { total: rawData.length, valid, rejected, reasons };
}
