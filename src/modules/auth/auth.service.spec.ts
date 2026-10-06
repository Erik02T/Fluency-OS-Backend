import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { Role, JLPTLevel } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { RedisService } from '../../common/services/redis.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

type TestConfig = Record<string, string>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: UserRepository;
  let jwtService: JwtService;
  let redisService: RedisService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed_password',
    displayName: 'Test User',
    avatarUrl: null,
    role: Role.STUDENT,
    jlptGoal: JLPTLevel.N3,
    isEmailVerified: false,
    isActive: true,
    lastActiveAt: null,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateUserDto = {
    email: 'test@example.com',
    password: 'SecurePass123',
    name: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            sanitizeUser: jest.fn((user: User): Omit<User, 'passwordHash'> => {
              const sanitized = { ...user };
              delete (sanitized as Partial<User>).passwordHash;
              return sanitized;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: TestConfig = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRATION: '15m',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return config[key];
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            storeRefreshToken: jest.fn(),
            validateRefreshToken: jest.fn(),
            invalidateRefreshToken: jest.fn(),
            findUserIdByRefreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepository>(UserRepository);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const findByEmailSpy = jest
        .spyOn(userRepository, 'findByEmail')
        .mockResolvedValue(null);
      const createSpy = jest
        .spyOn(userRepository, 'create')
        .mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('access_token_123');
      const storeRefreshTokenSpy = jest
        .spyOn(redisService, 'storeRefreshToken')
        .mockResolvedValue(undefined);

      const result = await service.register(mockCreateUserDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access_token_123');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
      expect(findByEmailSpy).toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalled();
      expect(storeRefreshTokenSpy).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

      await expect(service.register(mockCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: mockUser.email,
        password: 'SecurePass123',
      };

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const updateSpy = jest
        .spyOn(userRepository, 'update')
        .mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('access_token_123');
      jest
        .spyOn(redisService, 'storeRefreshToken')
        .mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access_token_123');
      expect(result.refreshToken).toBeDefined();
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({
          email: mockUser.email,
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenId = '550e8400-e29b-41d4-a716-446655440000';

      jest
        .spyOn(redisService, 'findUserIdByRefreshToken')
        .mockResolvedValue(mockUser.id);
      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      const signAsyncSpy = jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValue('new_access_token');

      const result = await service.refreshToken(refreshTokenId);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new_access_token');
      expect(result.role).toBe(mockUser.role);
      expect(signAsyncSpy).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      const invalidToken = 'invalid-token';

      await expect(service.refreshToken(invalidToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const refreshTokenId = '550e8400-e29b-41d4-a716-446655440000';

      jest
        .spyOn(redisService, 'findUserIdByRefreshToken')
        .mockResolvedValue(mockUser.id);
      const invalidateRefreshTokenSpy = jest
        .spyOn(redisService, 'invalidateRefreshToken')
        .mockResolvedValue(undefined);

      await expect(service.logout(refreshTokenId)).resolves.not.toThrow();
      expect(invalidateRefreshTokenSpy).toHaveBeenCalledWith(
        mockUser.id,
        refreshTokenId,
      );
    });
  });
});
