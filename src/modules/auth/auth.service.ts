import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto, LoginDto, AuthResponseDto } from './dto';
import { UserRepository } from './repositories/user.repository';
import { RedisService } from '../../common/services/redis.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
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
    const username = dto.email.split('@')[0] + uuidv4().slice(0, 4);

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
      const tokens = await this.generateTokens(user.id, user.email);

      // Retornar resposta
      return {
        ...tokens,
        user: this.userRepository.sanitizeUser(user),
      };
    } catch (error) {
      console.error('REGISTER ERROR:', error);
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
    const tokens = await this.generateTokens(user.id, user.email);

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

    // Buscar payload antigo do Redis (userId está armazenado como value)
    const storedUserId = await this.redisService.get(
      `refresh_token:*:${refreshToken}`,
    );

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
    const pattern = `refresh_token:*:${refreshToken}`;
    const storedUserId = await this.redisService.get(pattern);

    if (storedUserId) {
      // Deletar refresh token específico
      await this.redisService.invalidateRefreshToken(
        storedUserId,
        refreshToken,
      );
    }
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
    } catch (error) {
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
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
    });

    // Gerar refresh token único (UUID)
    const refreshToken = uuidv4();

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
