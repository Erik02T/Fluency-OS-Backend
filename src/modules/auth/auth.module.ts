import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository, PrismaService } from './repositories';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, PrismaService],
  exports: [AuthService, UserRepository, PrismaService],
})
export class AuthModule {}
