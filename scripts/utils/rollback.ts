/**
 * FASE 15 — Sistema de Rollback
 * Utilitários para reverter operações do pipeline de forma segura.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RollbackMetadata {
  id: string;
  timestamp: string;
  operation: string;
  phase: string;
  level?: string;
  type: 'database' | 'file' | 'mixed';
  backupPath?: string;
  databaseSnapshot?: {
    table: string;
    records: number;
    sourceIds: string[];
  };
  success: boolean;
  error?: string;
}

export interface RollbackOptions {
  phase: string;
  level?: string;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Gera ID único para rollback.
 */
function generateRollbackId(): string {
  return `rollback-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Cria diretório de backup.
 */
function ensureBackupDir(): string {
  const backupDir = path.join(
    path.resolve(__dirname, '../..'),
    'data',
    'backups',
  );
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

/**
 * Faz backup de arquivo antes de operação.
 */
export function backupFile(
  filePath: string,
  metadata: Omit<RollbackMetadata, 'id' | 'timestamp' | 'type'>,
): RollbackMetadata {
  if (!fs.existsSync(filePath)) {
    const rollbackMeta: RollbackMetadata = {
      id: generateRollbackId(),
      timestamp: new Date().toISOString(),
      type: 'file',
      operation: metadata.operation,
      phase: metadata.phase,
      level: metadata.level,
      success: false,
      error: 'Arquivo não existe',
    };
    return rollbackMeta;
  }

  const backupDir = ensureBackupDir();
  const fileHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')
    .substring(0, 8);
  const backupFileName = `${path.basename(filePath)}.${fileHash}.bak`;
  const backupPath = path.join(backupDir, backupFileName);

  fs.copyFileSync(filePath, backupPath);

  const rollbackMeta: RollbackMetadata = {
    id: generateRollbackId(),
    timestamp: new Date().toISOString(),
    type: 'file',
    operation: metadata.operation,
    phase: metadata.phase,
    level: metadata.level,
    backupPath,
    success: true,
  };

  // Salva metadados
  const metaPath = path.join(backupDir, `${rollbackMeta.id}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(rollbackMeta, null, 2));

  return rollbackMeta;
}

/**
 * Restaura arquivo do backup.
 */
export function restoreFile(rollbackId: string): RollbackMetadata {
  const backupDir = ensureBackupDir();
  const metaPath = path.join(backupDir, `${rollbackId}.json`);

  if (!fs.existsSync(metaPath)) {
    throw new Error(`Metadados de rollback não encontrados: ${rollbackId}`);
  }

  const metadata: RollbackMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  if (!metadata.backupPath || !fs.existsSync(metadata.backupPath)) {
    throw new Error(`Backup não encontrado: ${metadata.backupPath}`);
  }

  // Restaura arquivo
  const originalPath = metadata.backupPath.replace(/\.bak$/, '').replace(/\. [a-f0-9]{8}\.bak$/, '');
  fs.copyFileSync(metadata.backupPath, originalPath);

  // Remove backup após restauração
  fs.unlinkSync(metadata.backupPath);
  fs.unlinkSync(metaPath);

  return metadata;
}

/**
 * Cria snapshot de banco de dados antes de importação.
 */
export async function createDatabaseSnapshot(
  phase: string,
  level?: string,
): Promise<RollbackMetadata> {
  try {
    // Coleta dados de GrammarPoint por sourceId
    const grammarPoints = await prisma.grammarPoint.findMany({
      where: level ? { jlptLevel: level.toUpperCase() as any } : undefined,
      select: {
        id: true,
        sourceId: true,
        jlptLevel: true,
      },
    });

    const sourceIds = grammarPoints.map((gp) => gp.sourceId).filter(Boolean) as string[];

    const rollbackMeta: RollbackMetadata = {
      id: generateRollbackId(),
      timestamp: new Date().toISOString(),
      type: 'database',
      operation: 'import',
      phase,
      level,
      databaseSnapshot: {
        table: 'grammar_points',
        records: grammarPoints.length,
        sourceIds,
      },
      success: true,
    };

    // Salva metadados
    const backupDir = ensureBackupDir();
    const metaPath = path.join(backupDir, `${rollbackMeta.id}.json`);
    fs.writeFileSync(metaPath, JSON.stringify(rollbackMeta, null, 2));

    return rollbackMeta;
  } catch (error) {
    const rollbackMeta: RollbackMetadata = {
      id: generateRollbackId(),
      timestamp: new Date().toISOString(),
      type: 'database',
      operation: 'import',
      phase,
      level,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return rollbackMeta;
  }
}

/**
 * Executa rollback de banco de dados (remove registros importados).
 */
export async function rollbackDatabase(
  rollbackId: string,
  opts: { dryRun?: boolean; force?: boolean } = {},
): Promise<RollbackMetadata> {
  const backupDir = ensureBackupDir();
  const metaPath = path.join(backupDir, `${rollbackId}.json`);

  if (!fs.existsSync(metaPath)) {
    throw new Error(`Metadados de rollback não encontrados: ${rollbackId}`);
  }

  const metadata: RollbackMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  if (!metadata.databaseSnapshot) {
    throw new Error('Rollback não contém snapshot de banco de dados');
  }

  if (opts.dryRun) {
    console.log(`[DRY-RUN] Rollback de banco de dados: ${rollbackId}`);
    console.log(`  Tabela: ${metadata.databaseSnapshot.table}`);
    console.log(`  SourceIds: ${metadata.databaseSnapshot.sourceIds.length} registros`);
    return metadata;
  }

  if (!opts.force) {
    console.log('[WARN] Rollback de banco de dados requer --force');
    console.log('[WARN] Isso deletará registros do banco de dados');
    return metadata;
  }

  // Remove registros por sourceId
  const { count } = await prisma.grammarPoint.deleteMany({
    where: {
      sourceId: {
        in: metadata.databaseSnapshot.sourceIds,
      },
    },
  });

  console.log(`[ROLLBACK] Deletados ${count} registros de grammar_points`);

  // Remove metadados
  fs.unlinkSync(metaPath);

  return metadata;
}

/**
 * Lista rollbacks disponíveis.
 */
export function listRollbacks(): RollbackMetadata[] {
  const backupDir = ensureBackupDir();
  const rollbacks: RollbackMetadata[] = [];

  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    if (file.endsWith('.json') && file.startsWith('rollback-')) {
      const metaPath = path.join(backupDir, file);
      try {
        const metadata: RollbackMetadata = JSON.parse(
          fs.readFileSync(metaPath, 'utf8'),
        );
        rollbacks.push(metadata);
      } catch {
        // Ignora arquivos inválidos
      }
    }
  }

  return rollbacks.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Limpa rollbacks antigos (mais de 7 dias).
 */
export function cleanupOldRollbacks(): number {
  const backupDir = ensureBackupDir();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < sevenDaysAgo) {
      fs.unlinkSync(filePath);
      cleaned += 1;
    }
  }

  return cleaned;
}
