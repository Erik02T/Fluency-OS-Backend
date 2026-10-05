/**
 * FASE 14 — Sistema Unificado de Dry-Run
 * Utilitários centralizados para simulação de operações sem efeitos colaterais.
 */

export interface DryRunContext {
  enabled: boolean;
  phase: string;
  level?: string;
  timestamp: string;
}

export interface DryRunResult {
  success: boolean;
  operation: string;
  details: string;
  simulatedAt: string;
}

/**
 * Cria contexto de dry-run.
 */
export function createDryRunContext(phase: string, level?: string): DryRunContext {
  return {
    enabled: true,
    phase,
    level,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formata resultado de dry-run para log.
 */
export function formatDryRunLog(context: DryRunContext, operation: string): string {
  const levelPart = context.level ? ` [${context.level}]` : '';
  return `[DRY-RUN]${levelPart} ${context.phase}: ${operation}`;
}

/**
 * Simula operação de arquivo (sem efeitos).
 */
export function simulateFileOperation(
  context: DryRunContext,
  operation: 'read' | 'write' | 'delete',
  filePath: string,
): DryRunResult {
  return {
    success: true,
    operation: `${operation}:${filePath}`,
    details: `Simulação: ${operation} em ${filePath}`,
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Simula operação de banco de dados (sem efeitos).
 */
export function simulateDatabaseOperation(
  context: DryRunContext,
  operation: 'create' | 'update' | 'delete' | 'query',
  table: string,
  count?: number,
): DryRunResult {
  const countPart = count !== undefined ? ` (${count} registros)` : '';
  return {
    success: true,
    operation: `${operation}:${table}${countPart}`,
    details: `Simulação: ${operation} em ${table}${countPart}`,
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Simula operação de API (sem efeitos).
 */
export function simulateApiOperation(
  context: DryRunContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
): DryRunResult {
  return {
    success: true,
    operation: `${method} ${endpoint}`,
    details: `Simulação: ${method} request para ${endpoint}`,
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Valida se dry-run está habilitado para uma operação.
 */
export function shouldSkipRealOperation(dryRun: boolean, operation: string): boolean {
  if (!dryRun) return false;
  console.log(`[DRY-RUN] Pulando operação real: ${operation}`);
  return true;
}
