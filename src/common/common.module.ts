import { Module } from '@nestjs/common';
import { RedisService } from './services';

/**
 * CommonModule
 * Fornece serviços comuns (Redis, etc) para toda a aplicação
 */
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class CommonModule {}
