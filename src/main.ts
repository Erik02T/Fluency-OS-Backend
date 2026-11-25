import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  parseFrontendOrigins,
  parseTrustedProxies,
} from './config/validation.schema';

function configureSwagger(app: INestApplication): void {
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
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const production = process.env.NODE_ENV === 'production';
  const trustedProxies = parseTrustedProxies(process.env.TRUST_PROXY);
  if (trustedProxies.length) {
    app.set('trust proxy', trustedProxies);
  }

  const allowedOrigins =
    process.env.FRONTEND_URL === undefined && !production
      ? ['http://localhost:3000']
      : parseFrontendOrigins(process.env.FRONTEND_URL);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === undefined
      ? !production
      : process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) configureSwagger(app);

  const port = Number(process.env.APP_PORT || process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log('API listening on port ' + port);
  if (swaggerEnabled) console.log('Swagger is available at /docs');
}
void bootstrap();
