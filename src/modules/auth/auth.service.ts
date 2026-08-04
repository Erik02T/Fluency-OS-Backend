import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { CreateUserDto, LoginDto, AuthResponseDto } from './dto';
import { UserRepository } from './repositories/user.repository';
import { RedisService } from '../../common/services/redis.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * Registra um novo usuário
   * @param dto CreateUserDto com email, password, name
   * @returns AuthResponseDto com tokens
   */
  async register(dto: CreateUserDto): Promise<AuthResponseDto> {
    // Validar se email já existe
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Gerar username único a partir do email
    const username = dto.email.split('@')[0] + randomUUID().slice(0, 4);

    try {
      // Hash da senha
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Criar usuário
      const user = await this.userRepository.create({
        email: dto.email,
        username,
        passwordHash,
        displayName: dto.name,
      });

      // Gerar tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      // Retornar resposta
      return {
        ...tokens,
        user: this.userRepository.sanitizeUser(user),
      };
    } catch (error) {
      this.logger.error(
        `Failed to register user: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Faz login de um usuário
   * @param dto LoginDto com email e password
   * @returns AuthResponseDto com tokens
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Buscar usuário
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Validar senha
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Atualizar lastLoginAt
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: this.userRepository.sanitizeUser(user),
    };
  }

  /**
   * Renova o access token usando refresh token
   * @param refreshToken Refresh token válido (UUID armazenado em Redis)
   * @returns Novo access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Validar formato de UUID
    if (!this.isValidUUID(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Localizar o userId associado ao refresh token salvo
    const storedUserId =
      await this.redisService.findUserIdByRefreshToken(refreshToken);

    if (!storedUserId) {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    // Buscar usuário para validar que ainda existe
    const user = await this.userRepository.findById(storedUserId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Gerar novo access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
    });

    return { accessToken };
  }

  /**
   * Faz logout do usuário invalidando refresh token
   * @param refreshToken Refresh token a invalidar
   */
  async logout(refreshToken: string): Promise<void> {
    if (!this.isValidUUID(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Buscar userId do refresh token para deletar corretamente
    const storedUserId =
      await this.redisService.findUserIdByRefreshToken(refreshToken);

    if (storedUserId) {
      // Deletar refresh token específico
      await this.redisService.invalidateRefreshToken(
        storedUserId,
        refreshToken,
      );
    }
  }

  /**
   * Retorna os dados públicos do usuário autenticado
   * @param userId ID do usuário autenticado
   */
  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.userRepository.sanitizeUser(user);
  }

  /**
   * Valida um JWT token
   * @param token JWT token
   * @returns JwtPayload se válido
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Gera access token e refresh token
   * @param userId ID do usuário
   * @param email Email do usuário
   * @returns { accessToken, refreshToken }
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: JwtPayload['role'],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
    });

    // Gerar refresh token único (UUID)
    const refreshToken = randomUUID();

    // Armazenar em Redis com TTL de 7 dias
    await this.redisService.storeRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  }

  /**
   * Validar formato UUID v4
   * @param token Token a validar
   * @returns true se é UUID válido
   */
  private isValidUUID(token: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }
}
