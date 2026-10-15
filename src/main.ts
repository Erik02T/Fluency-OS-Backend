import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // Adicionar validação automática de DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configurar Swagger
  const config = new DocumentBuilder()
    .setTitle('Fluency OS — Backend API')
    .setDescription(
      'API de backend para Fluency OS, sistema premium de aquisição natural de japonês',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Autenticação e gerenciamento de usuários')
    .addTag('Kanji', 'Banco de Kanji com filtros e busca')
    .addTag(
      'Vocabulary',
      'Banco de vocabulário com filtros, detalhe e progresso',
    )
    .addTag('Grammar', 'Banco de gramática, exemplos e progresso')
    .addTag('Review', 'Sessões de revisão espaçada (SRS SM-2)')
    .addTag('Planner', 'Planejamento semanal, metas e tarefas diárias')
    .addTag('Immersion', 'Logs e acompanhamento de imersão')
    .addTag('Analytics', 'Métricas e séries temporais de aprendizado')
    .addTag('Dashboard', 'Resumo agregado e status do aluno')
    .addTag('Health', 'Status da aplicação')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.APP_PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/docs`);
}
void bootstrap();
