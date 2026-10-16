import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/auth/repositories/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

interface TaskResponseBody {
  id: string;
  userId: string;
  weeklyPlanId: string | null;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  kanjiGlyph: string;
  date: string;
  estimatedMinutes: number;
  priority: string;
  status: string;
  completedAt: string | null;
}

interface HistoryEntryBody {
  id: string;
  taskId: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
}

interface SummaryBody {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionPercentage: number;
  minutesStudied: number;
  categoriesStudied: string[];
  streak: number;
}

interface WeekPlanBody {
  id: string;
  userId: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  goals: Array<{
    id: string;
    category: string;
    name: string;
    kanjiGlyph: string;
    targetValue: number;
    currentValue: number;
    percentage: number;
    unit: string;
  }>;
}

interface OverviewBody {
  week: Array<{ date: number; day: string; isToday: boolean }>;
  habits: Array<{ id: string; domain: string; completedThisWeek: boolean[] }>;
  todayTasks: Array<{ id: string; completed: boolean }>;
  weeklyGoals: Array<{ name: string; current: number; target: number }>;
  summary: { tasksTotalToday: number; currentStreakDays: number };
}

function assertLoginResponse(body: unknown): asserts body is LoginResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    !('user' in body)
  ) {
    throw new Error('Invalid login response body');
  }
}

function assertTaskBody(body: unknown): asserts body is TaskResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('categoryLabel' in body) ||
    !('status' in body)
  ) {
    throw new Error('Invalid task response body');
  }
}

function assertHistoryBody(body: unknown): asserts body is HistoryEntryBody[] {
  if (!Array.isArray(body)) {
    throw new Error('Invalid history response body');
  }
  for (const entry of body) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('oldStatus' in entry) ||
      !('newStatus' in entry)
    ) {
      throw new Error('Invalid history entry body');
    }
  }
}

function assertTasksBody(body: unknown): asserts body is TaskResponseBody[] {
  if (!Array.isArray(body)) {
    throw new Error('Invalid tasks response body');
  }
}

function assertSummaryBody(body: unknown): asserts body is SummaryBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('completionPercentage' in body) ||
    !('streak' in body)
  ) {
    throw new Error('Invalid summary response body');
  }
}

function assertWeekBody(body: unknown): asserts body is WeekPlanBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('goals' in body) ||
    !Array.isArray((body as { goals?: unknown }).goals)
  ) {
    throw new Error('Invalid week plan response body');
  }
}

function assertOverviewBody(body: unknown): asserts body is OverviewBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('week' in body) ||
    !('habits' in body) ||
    !('summary' in body)
  ) {
    throw new Error('Invalid overview response body');
  }
}

function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function weekStartOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const ts = Date.parse(`${date}T12:00:00Z`) - dow * 86_400_000;
  return new Date(ts).toISOString().slice(0, 10);
}

describe('Planner E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let otherAccessToken = '';

  const suffix = Date.now().toString(36);
  const email = `planner-student-${suffix}@example.com`;
  const otherEmail = `planner-other-${suffix}@example.com`;
  const password = 'SecurePass123';
  const today = todayInSaoPaulo();

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password,
      name: 'Planner Student',
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    accessToken = login.body.accessToken;
    userId = login.body.user.id;

    await request(app.getHttpServer()).post('/auth/register').send({
      email: otherEmail,
      password,
      name: 'Planner Other',
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    assertLoginResponse(otherLogin.body);
    otherAccessToken = otherLogin.body.accessToken;

    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, timezone: 'America/Sao_Paulo' },
      update: { timezone: 'America/Sao_Paulo' },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.plannerHistory.deleteMany({
      where: { task: { userId } },
    });
    await prisma.plannerTask.deleteMany({ where: { userId } });
    await prisma.weeklyPlan.deleteMany({ where: { userId } });
    await prisma.streakHistory.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await app.close();
  });

  let firstTaskId = '';
  let planId = '';
  const extraTaskIds: string[] = [];

  it('cria tarefa com defaults (POST /planner/tasks → 201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/planner/tasks')
      .set(authHeader(accessToken))
      .send({ title: 'Revisar 10 kanjis', date: today, category: 'KANJI' })
      .expect(201);

    assertTaskBody(response.body);
    expect(response.body.userId).toBe(userId);
    expect(response.body.status).toBe('PENDING');
    expect(response.body.categoryLabel).toBe('Kanji');
    expect(response.body.kanjiGlyph).toBe('字');
    expect(response.body.weeklyPlanId).toEqual(expect.any(String));

    firstTaskId = response.body.id;
    planId = response.body.weeklyPlanId as string;
  });

  it('rejeita payload inválido com 400', async () => {
    await request(app.getHttpServer())
      .post('/planner/tasks')
      .set(authHeader(accessToken))
      .send({ date: today })
      .expect(400);
  });

  it('lista tarefas do dia (GET /planner/tasks?date=)', async () => {
    const response = await request(app.getHttpServer())
      .get('/planner/tasks')
      .set(authHeader(accessToken))
      .query({ date: today })
      .expect(200);

    assertTasksBody(response.body);
    expect(response.body.map((task) => task.id)).toContain(firstTaskId);
  });

  it('conclui tarefa e grava 1 histórico (PATCH /complete → toggle)', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/planner/tasks/${firstTaskId}/complete`)
      .set(authHeader(accessToken))
      .send({ completed: true })
      .expect(200);

    assertTaskBody(response.body);
    expect(response.body.status).toBe('COMPLETED');

    const history = await request(app.getHttpServer())
      .get(`/planner/tasks/${firstTaskId}/history`)
      .set(authHeader(accessToken))
      .expect(200);

    assertHistoryBody(history.body);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({
      taskId: firstTaskId,
      oldStatus: 'PENDING',
      newStatus: 'COMPLETED',
    });
  });

  it('reconcluir tarefa já concluída é idempotente (sem histórico novo)', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/planner/tasks/${firstTaskId}/complete`)
      .set(authHeader(accessToken))
      .send({ completed: true })
      .expect(200);

    assertTaskBody(response.body);
    expect(response.body.status).toBe('COMPLETED');

    const history = await request(app.getHttpServer())
      .get(`/planner/tasks/${firstTaskId}/history`)
      .set(authHeader(accessToken))
      .expect(200);

    assertHistoryBody(history.body);
    expect(history.body).toHaveLength(1);
  });

  it('80% das tarefas concluídas registra streak (dia bom)', async () => {
    // Cria + conclui 3 tarefas extras: 4/5 = 80%
    for (let index = 0; index < 3; index += 1) {
      const created = await request(app.getHttpServer())
        .post('/planner/tasks')
        .set(authHeader(accessToken))
        .send({ title: `Tarefa extra ${index}`, date: today })
        .expect(201);

      assertTaskBody(created.body);
      extraTaskIds.push(created.body.id);

      await request(app.getHttpServer())
        .patch(`/planner/tasks/${created.body.id}/complete`)
        .set(authHeader(accessToken))
        .send({ completed: true })
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .get('/planner/summary/today')
      .set(authHeader(accessToken))
      .expect(200);

    assertSummaryBody(response.body);
    expect(response.body.totalTasks).toBe(4);
    expect(response.body.completedTasks).toBe(4);
    expect(response.body.completionPercentage).toBe(100);
    expect(response.body.minutesStudied).toBeGreaterThan(0);
    expect(response.body.streak).toBeGreaterThanOrEqual(1);

    const streak = await prisma.streakHistory.findFirst({
      where: { userId, activityDate: today },
    });
    expect(streak).not.toBeNull();
  });

  it('overview devolve semana, tarefas e resumo (GET /planner/overview)', async () => {
    const response = await request(app.getHttpServer())
      .get('/planner/overview')
      .set(authHeader(accessToken))
      .query({ date: today })
      .expect(200);

    assertOverviewBody(response.body);
    expect(response.body.week).toHaveLength(7);
    expect(response.body.todayTasks.length).toBeGreaterThanOrEqual(4);
    expect(response.body.summary.tasksTotalToday).toBe(4);
    expect(response.body.summary.currentStreakDays).toBeGreaterThanOrEqual(1);
  });

  it('week devolve plano com metas (GET /planner/week)', async () => {
    const response = await request(app.getHttpServer())
      .get('/planner/week')
      .set(authHeader(accessToken))
      .query({ date: today })
      .expect(200);

    assertWeekBody(response.body);
    expect(response.body.id).toBe(planId);
    expect(response.body.startDate).toBe(weekStartOf(today));
    expect(response.body.goals.length).toBeGreaterThanOrEqual(8);
    const kanjiGoal = response.body.goals.find(
      (goal) => goal.category === 'KANJI',
    );
    expect(kanjiGoal?.currentValue).toBeGreaterThanOrEqual(1);
  });

  it('atualiza metas semanais (PUT /planner/weeks/:id/goals)', async () => {
    const response = await request(app.getHttpServer())
      .put(`/planner/weeks/${planId}/goals`)
      .set(authHeader(accessToken))
      .send({
        goals: [{ category: 'IMMERSION', targetValue: 450, unit: 'min' }],
      })
      .expect(200);

    assertWeekBody(response.body);
    const immersionGoal = response.body.goals.find(
      (goal) => goal.category === 'IMMERSION',
    );
    expect(immersionGoal?.targetValue).toBe(450);
  });

  it('atualiza plano semanal (PATCH /planner/weeks/:id)', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/planner/weeks/${planId}`)
      .set(authHeader(accessToken))
      .send({ notes: 'Foco em kanji' })
      .expect(200);

    assertWeekBody(response.body);
    expect(response.body.notes).toBe('Foco em kanji');
  });

  it('atualiza tarefa via PATCH (campos + status)', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/planner/tasks/${firstTaskId}`)
      .set(authHeader(accessToken))
      .send({ title: 'Revisar 10 kanjis do N5', status: 'PENDING' })
      .expect(200);

    assertTaskBody(response.body);
    expect(response.body.title).toBe('Revisar 10 kanjis do N5');
    expect(response.body.status).toBe('PENDING');
  });

  it('remove tarefa via DELETE', async () => {
    const taskId = extraTaskIds.pop() as string;
    const response = await request(app.getHttpServer())
      .delete(`/planner/tasks/${taskId}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body).toEqual({ success: true, id: taskId });

    await request(app.getHttpServer())
      .get(`/planner/tasks/${taskId}`)
      .set(authHeader(accessToken))
      .expect(404);
  });

  it('usuário B não enxerga tarefa do usuário A (404)', async () => {
    await request(app.getHttpServer())
      .get(`/planner/tasks/${firstTaskId}`)
      .set(authHeader(otherAccessToken))
      .expect(404);
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/planner/tasks').expect(401);
    await request(app.getHttpServer())
      .get('/planner/summary/today')
      .expect(401);
  });
});
