import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import { z } from 'zod';
import { BACKEND_ROOT } from '../utils';
import type { TranslationBatchInput } from './translation-schema';

export const DEFAULT_LOCAL_TRANSLATION_MODEL = 'opus-2021-02-23-int8-pob';
export const DEFAULT_LOCAL_TRANSLATION_MODEL_DIR = path.join(
  os.homedir(),
  '.cache',
  'fluency-os',
  'opus',
  'opus-2021-02-23-ct2-int8',
);

const LocalWorkerReplySchema = z.discriminatedUnion('ok', [
  z
    .object({
      requestId: z.string().min(1),
      ok: z.literal(true),
      response: z.string().min(1),
    })
    .strict(),
  z
    .object({
      requestId: z.string().min(1),
      ok: z.literal(false),
      error: z.string().min(1),
    })
    .strict(),
]);

export function parseLocalWorkerReply(
  line: string,
  expectedRequestId: string,
): string {
  const reply = LocalWorkerReplySchema.parse(JSON.parse(line));
  if (reply.requestId !== expectedRequestId) {
    throw new Error('Resposta do worker local não corresponde à requisição.');
  }
  if (!reply.ok) throw new Error(reply.error);
  return reply.response;
}

interface PendingRequest {
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}

export class LocalTranslationWorker {
  readonly model: string;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: Interface;
  private readonly pending = new Map<string, PendingRequest>();
  private requestNumber = 0;
  private stderr = '';
  private closed = false;

  constructor(model = DEFAULT_LOCAL_TRANSLATION_MODEL) {
    this.model = model;
    const python =
      process.env.GRAMMAR_TRANSLATION_PYTHON?.trim() ||
      path.join(
        BACKEND_ROOT,
        '.venv',
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
      );
    const worker = path.join(
      BACKEND_ROOT,
      'scripts',
      'grammar',
      'local_translation_worker.py',
    );

    if (!fs.existsSync(python)) {
      throw new Error(
        `Python do tradutor não encontrado: ${python}. Configure GRAMMAR_TRANSLATION_PYTHON ou instale o venv local.`,
      );
    }
    if (!fs.existsSync(worker)) {
      throw new Error(`Worker local não encontrado: ${worker}`);
    }

    this.child = spawn(python, [worker], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        GRAMMAR_LOCAL_TRANSLATION_MODEL_DIR:
          process.env.GRAMMAR_LOCAL_TRANSLATION_MODEL_DIR?.trim() ||
          DEFAULT_LOCAL_TRANSLATION_MODEL_DIR,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-4000);
    });
    this.child.on('error', (error) => this.failPending(error));
    this.child.on('close', (code, signal) => {
      this.closed = true;
      const details = this.stderr.trim();
      const reason = new Error(
        `Worker local encerrou (code=${code ?? 'null'}, signal=${signal ?? 'none'})${details ? `: ${details}` : ''}`,
      );
      this.failPending(reason);
    });
  }

  translateBatch(input: TranslationBatchInput): Promise<string> {
    if (this.closed) {
      return Promise.reject(new Error('Worker local já foi encerrado.'));
    }

    const requestId = `translation-${++this.requestNumber}`;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.child.stdin.write(
        `${JSON.stringify({ requestId, input })}\n`,
        (error) => {
          if (!error) return;
          this.pending.delete(requestId);
          reject(error);
        },
      );
    });
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.child.once('close', () => resolve());
      this.child.stdin.end();
    });
  }

  private handleLine(line: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(line);
    } catch (error) {
      this.failPending(
        new Error(
          `Worker local retornou JSON inválido: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return;
    }

    const requestId =
      typeof payload === 'object' &&
      payload !== null &&
      'requestId' in payload &&
      typeof payload.requestId === 'string'
        ? payload.requestId
        : null;
    if (!requestId) {
      this.failPending(new Error('Worker local retornou requestId inválido.'));
      return;
    }

    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);

    try {
      pending.resolve(parseLocalWorkerReply(line, requestId));
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private failPending(error: Error): void {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
}