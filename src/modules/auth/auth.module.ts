import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository, PrismaService } from './repositories';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '15m') as StringValue,
        },
      }),
    }),
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, PrismaService],
  exports: [AuthService, UserRepository, PrismaService],
})
export class AuthModule {}
