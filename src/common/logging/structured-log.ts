import { getRequestId } from './request-context';

type LogLevel = 'info' | 'warn' | 'error';

type StructuredLogFields = object;

function writeLine(level: LogLevel, line: string): void {
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export function logStructured(
  level: LogLevel,
  context: string,
  event: string,
  fields: StructuredLogFields = {},
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    context,
    event,
    requestId: getRequestId(),
    ...(fields as Record<string, unknown>),
  };

  writeLine(level, JSON.stringify(payload));
}
