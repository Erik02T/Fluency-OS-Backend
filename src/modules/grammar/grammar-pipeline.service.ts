import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GrammarPipelineRun, JLPTLevel, Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  buildGrammarExampleData,
  buildGrammarPointSeedUpdateData,
  buildGrammarPointUpsertData,
  grammarExamplesMatch,
  type SeedGrammarRecord,
} from '../../../prisma/seed-grammar';
import { validateSeedDataset } from '../../../scripts/grammar/seed-record-validation';
import { PrismaService } from '../auth/repositories/prisma.service';
import {
  RollbackGrammarPipelineDto,
  RunGrammarPipelineDto,
} from './dto/grammar-pipeline.dto';

const includeExamples = {
  examples: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.GrammarPointInclude;

type GrammarPoint = Prisma.GrammarPointGetPayload<{
  include: typeof includeExamples;
}>;
type Snapshot = Omit<GrammarPoint, 'createdAt' | 'updatedAt' | 'reviewedAt'> & {
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};
type Change = { before: Snapshot | null; after: Snapshot };
type Operation = Pick<
  GrammarPipelineRun,
  'operation' | 'level' | 'rollbackId' | 'dryRun'
>;
type Result = Prisma.InputJsonObject;

@Injectable()
export class GrammarPipelineService {
  private readonly logger = new Logger(GrammarPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  run(dto: RunGrammarPipelineDto, key?: string) {
    return this.execute(
      {
        operation: dto.phase,
        level: dto.level,
        rollbackId: null,
        dryRun: dto.dryRun ?? false,
      },
      dto.phase === 'import' && !dto.dryRun ? this.requireKey(key) : undefined,
      async (tx, runId) => {
        const records = await this.readDataset(dto.level);
        if (dto.phase === 'validate') {
          return { total: records.length, valid: records.length };
        }

        await this.lockLevel(tx, dto.level);
        const existing = await tx.grammarPoint.findMany({
          where: { jlptLevel: dto.level },
          include: includeExamples,
        });
        const changes: Change[] = [];
        let created = 0;
        let updated = 0;

        for (const record of records) {
          const data = buildGrammarPointUpsertData(record);
          const content = buildGrammarPointSeedUpdateData(record, data);
          const matches = existing.filter(
            (point) =>
              point.sourceId === data.sourceId &&
              point.source === (data.source ?? null),
          );
          if (matches.length > 1) {
            throw new ConflictException(
              `Multiple grammar points use source ID ${data.sourceId}`,
            );
          }

          const before = matches[0];
          const examples = buildGrammarExampleData(record.examples);
          const examplesMatch =
            before && grammarExamplesMatch(before.examples, examples);
          const contentMatches =
            before &&
            Object.entries(content).every(
              ([field, value]) =>
                value === undefined ||
                isDeepStrictEqual(before[field as keyof GrammarPoint], value),
            );
          if (contentMatches && examplesMatch) {
            continue;
          }

          if (before) {
            updated++;
          } else {
            created++;
          }
          if (dto.dryRun) {
            continue;
          }

          const point = before
            ? await tx.grammarPoint.update({
                where: { id: before.id },
                data: content,
              })
            : await tx.grammarPoint.create({ data });
          if (!examplesMatch) {
            await tx.grammarExample.deleteMany({
              where: { grammarPointId: point.id },
            });
            await tx.grammarExample.createMany({
              data: examples.map((example) => ({
                ...example,
                grammarPointId: point.id,
              })),
            });
          }
          const after = await tx.grammarPoint.findUniqueOrThrow({
            where: { id: point.id },
            include: includeExamples,
          });
          changes.push({
            before: before ? this.snapshot(before) : null,
            after: this.snapshot(after),
          });
        }

        const rollback = changes.length
          ? await tx.grammarPipelineRollback.create({
              data: {
                runId,
                level: dto.level,
                changes,
              },
            })
          : null;
        return {
          created,
          updated,
          unchanged: records.length - created - updated,
          rollbackId: rollback?.id ?? null,
        };
      },
    );
  }

  rollback(dto: RollbackGrammarPipelineDto, key?: string) {
    return this.execute(
      {
        operation: 'rollback',
        level: null,
        rollbackId: dto.rollbackId,
        dryRun: dto.dryRun ?? false,
      },
      !dto.dryRun ? this.requireKey(key) : undefined,
      async (tx) => {
        const where = { id: dto.rollbackId };
        const initial = await tx.grammarPipelineRollback.findUnique({
          where,
          select: { level: true },
        });
        if (!initial) {
          throw new NotFoundException('Rollback not found');
        }
        await this.lockLevel(tx, initial.level);
        const entry = await tx.grammarPipelineRollback.findUniqueOrThrow({
          where,
        });
        const changes = entry.changes as unknown as Change[];
        const removed = changes.filter(({ before }) => !before).length;
        const result = {
          rollbackId: entry.id,
          removed,
          restored: changes.length - removed,
        };
        if (entry.appliedAt) {
          return { ...result, appliedAt: entry.appliedAt.toISOString() };
        }

        for (const { before, after } of changes) {
          const current = await tx.grammarPoint.findUnique({
            where: { id: after.id },
            include: includeExamples,
          });
          if (!current || !isDeepStrictEqual(this.snapshot(current), after)) {
            throw new ConflictException(
              `Grammar point ${after.id} changed after import`,
            );
          }
          if (
            !before &&
            (await tx.userGrammarProgress.count({
              where: { grammarPointId: after.id },
            }))
          ) {
            throw new ConflictException(
              `Grammar point ${after.id} has study progress`,
            );
          }
        }

        if (dto.dryRun) {
          return { ...result, appliedAt: null };
        }
        for (const { before, after } of changes) {
          if (before) {
            await this.restorePoint(tx, before);
          } else {
            await tx.grammarPoint.delete({ where: { id: after.id } });
          }
        }
        const appliedAt = new Date();
        await tx.grammarPipelineRollback.update({ where, data: { appliedAt } });
        return { ...result, appliedAt: appliedAt.toISOString() };
      },
    );
  }

  async listRuns() {
    const runs = await this.prisma.grammarPipelineRun.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { runs: runs.map((run) => this.publicRun(run)) };
  }

  async listRollbacks() {
    const rollbacks = await this.prisma.grammarPipelineRollback.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        runId: true,
        level: true,
        createdAt: true,
        appliedAt: true,
      },
    });
    return {
      rollbacks: rollbacks.map((rollback) => ({
        ...rollback,
        status: rollback.appliedAt ? 'applied' : 'available',
      })),
    };
  }

  private requireKey(key?: string): string {
    if (!key || !/^[A-Za-z0-9_.:-]{1,128}$/.test(key)) {
      throw new BadRequestException(
        'A valid Idempotency-Key header is required',
      );
    }
    return key;
  }

  private async execute(
    operation: Operation,
    key: string | undefined,
    work: (tx: Prisma.TransactionClient, runId: string) => Promise<Result>,
  ) {
    let run: GrammarPipelineRun;
    try {
      run = await this.prisma.grammarPipelineRun.create({
        data: { ...operation, idempotencyKey: key },
      });
    } catch (error) {
      if (
        !key ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      run = await this.prisma.grammarPipelineRun.findUniqueOrThrow({
        where: { idempotencyKey: key },
      });
      if (
        Object.entries(operation).some(
          ([field, value]) => run[field as keyof Operation] !== value,
        )
      ) {
        throw new ConflictException(
          'Idempotency-Key already belongs to a different operation',
        );
      }
    }

    const finished = await this.prisma.$transaction(
      async (tx) => {
        const [current] = await tx.$queryRaw<GrammarPipelineRun[]>`SELECT *
        FROM "grammar_pipeline_runs" WHERE "id" = ${run.id} FOR UPDATE`;
        if (current.finishedAt) {
          return current;
        }
        // Keep the failure audit in the same commit while undoing catalog changes.
        await tx.$executeRaw`SAVEPOINT grammar_pipeline_changes`;
        let result: Result;
        let httpStatus = 200;
        try {
          result = await work(tx, run.id);
        } catch (error) {
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT grammar_pipeline_changes`;
          if (error instanceof HttpException) {
            httpStatus = error.getStatus();
            const response = error.getResponse();
            result =
              typeof response === 'string'
                ? { message: response }
                : { ...response };
          } else {
            httpStatus = 500;
            result = { message: 'Grammar pipeline operation failed' };
            this.logger.error(
              `Grammar pipeline run ${run.id} failed`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
        return tx.grammarPipelineRun.update({
          where: { id: run.id },
          data: { httpStatus, result, finishedAt: new Date() },
        });
      },
      { timeout: 60_000 },
    );
    const output = this.publicRun(finished);
    if (finished.httpStatus !== 200) {
      throw new HttpException(output, finished.httpStatus ?? 500);
    }
    return output;
  }

  private publicRun(run: GrammarPipelineRun) {
    return {
      id: run.id,
      operation: run.operation,
      level: run.level,
      dryRun: run.dryRun,
      rollbackId: run.rollbackId,
      status: run.finishedAt
        ? run.httpStatus === 200
          ? 'succeeded'
          : 'failed'
        : 'pending',
      result: run.result,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
    };
  }

  private async lockLevel(tx: Prisma.TransactionClient, level: JLPTLevel) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'grammar-pipeline:' + level}))`;
    await tx.$queryRaw`SELECT "id" FROM "grammar_points"
      WHERE "jlptLevel" = ${level}::"JLPTLevel" ORDER BY "id" FOR UPDATE`;
  }

  private async readDataset(level: JLPTLevel): Promise<SeedGrammarRecord[]> {
    let input: unknown;
    try {
      input = JSON.parse(
        await readFile(
          join(process.cwd(), 'seed', 'grammar', `${level.toLowerCase()}.json`),
          'utf8',
        ),
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new UnprocessableEntityException(
          'Grammar seed is not valid JSON',
        );
      }
      throw new InternalServerErrorException(
        'Grammar seed artifact is unavailable',
      );
    }
    let parsed: ReturnType<typeof validateSeedDataset>;
    try {
      parsed = validateSeedDataset(input, level);
    } catch {
      throw new UnprocessableEntityException(
        'Grammar seed has malformed records',
      );
    }
    const exampleIssues = parsed.valid.flatMap((record) =>
      record.examples.some(
        (example) =>
          typeof example.translation !== 'string' ||
          !example.translation.trim(),
      )
        ? [{ id: record.id, reasons: ['Each example requires a translation'] }]
        : [],
    );
    const issues = [
      ...parsed.rejected.map(({ record, reasons }) => ({
        id: record.id,
        reasons,
      })),
      ...exampleIssues,
    ];
    if (issues.length) {
      throw new UnprocessableEntityException({
        message: 'Grammar seed failed validation',
        issues,
      });
    }
    const sourceKeys = parsed.valid.map((record) =>
      JSON.stringify([
        record.source?.trim() || null,
        record.sourceId?.trim() || record.id,
      ]),
    );
    if (new Set(sourceKeys).size !== sourceKeys.length) {
      throw new UnprocessableEntityException(
        'Grammar seed contains duplicate source IDs',
      );
    }
    return parsed.valid as SeedGrammarRecord[];
  }

  private snapshot(point: GrammarPoint): Snapshot {
    return {
      ...point,
      createdAt: point.createdAt.toISOString(),
      updatedAt: point.updatedAt.toISOString(),
      reviewedAt: point.reviewedAt?.toISOString() ?? null,
    };
  }

  private async restorePoint(tx: Prisma.TransactionClient, snapshot: Snapshot) {
    const {
      id,
      examples,
      enrichmentData,
      patternFurigana,
      patternKanjiBreakdown,
      ...data
    } = snapshot;
    await tx.grammarPoint.update({
      where: { id },
      data: {
        ...data,
        enrichmentData: enrichmentData ?? Prisma.DbNull,
        patternFurigana: patternFurigana ?? Prisma.DbNull,
        patternKanjiBreakdown: patternKanjiBreakdown ?? Prisma.DbNull,
      },
    });
    await tx.grammarExample.deleteMany({ where: { grammarPointId: id } });
    await tx.grammarExample.createMany({
      data: examples.map(({ furigana, kanjiBreakdown, ...example }) => ({
        ...example,
        furigana: furigana ?? Prisma.DbNull,
        kanjiBreakdown: kanjiBreakdown ?? Prisma.DbNull,
      })),
    });
  }
}
