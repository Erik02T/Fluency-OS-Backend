import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, RefreshDto, AuthResponseDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import type { Response } from 'express';
import {
  ADMIN_REFRESH_COOKIE,
  AUTH_ROLE_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants';
import { createSignedRoleCookieValue } from './auth-role-cookie';
import { logStructured } from '../../common/logging/structured-log';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private toPublicAuthResponse(result: {
    accessToken: string;
    user: AuthResponseDto['user'];
  }): AuthResponseDto {
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  private getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    };
  }

  private setAuthCookies(
    res: Response,
    refreshToken: string,
    role: Role,
  ): void {
    res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, this.getCookieOptions());
    res.cookie(
      AUTH_ROLE_COOKIE,
      createSignedRoleCookieValue(role),
      this.getCookieOptions(),
    );
  }

  private clearAuthCookies(res: Response): void {
    const clearOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    res.clearCookie(ADMIN_REFRESH_COOKIE, clearOptions);
    res.clearCookie(AUTH_ROLE_COOKIE, clearOptions);
  }

  private parseRefreshTokenFromCookie(cookieHeader?: string): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith(`${ADMIN_REFRESH_COOKIE}=`),
    );

    if (!refreshCookie) {
      return null;
    }

    const [, value] = refreshCookie.split('=');
    return value || null;
  }

  private resolveRefreshToken(
    dto: RefreshDto,
    req: AuthenticatedRequest,
  ): string | undefined {
    const tokenFromBody = dto.refreshToken?.trim();
    if (tokenFromBody) {
      return tokenFromBody;
    }

    const tokenFromCookie = this.parseRefreshTokenFromCookie(
      req.headers.cookie,
    );

    return tokenFromCookie?.trim() || undefined;
  }

  /**
   * POST /auth/register
   * Registra um novo usuário
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiCreatedResponse({
    description: 'Usuário registrado com sucesso',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email já está em uso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou senha fraca',
  })
  async register(
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    logStructured('info', 'AuthController', 'auth.register.request', {
      email: dto.email,
    });

    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.refreshToken, result.user.role);
    logStructured('info', 'AuthController', 'auth.register.success', {
      userId: result.user.id,
      email: result.user.email,
    });
    return this.toPublicAuthResponse(result);
  }

  /**
   * POST /auth/login
   * Faz login do usuário
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login' })
  @ApiResponse({
    status: 200,
    description: 'Login bem-sucedido',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Email ou senha inválidos',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    logStructured('info', 'AuthController', 'auth.login.request', {
      email: dto.email,
    });

    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.refreshToken, result.user.role);
    logStructured('info', 'AuthController', 'auth.login.success', {
      userId: result.user.id,
      email: result.user.email,
    });
    return this.toPublicAuthResponse(result);
  }

  /**
   * POST /auth/refresh
   * Renova o access token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token renovado',
    schema: { properties: { accessToken: { type: 'string' } } },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido ou expirado',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    logStructured('info', 'AuthController', 'auth.refresh.request', {
      hasBodyToken: Boolean(dto.refreshToken?.trim()),
    });

    const refreshToken = this.resolveRefreshToken(dto, req);
    const result = await this.authService.refreshToken(refreshToken ?? '');
    res.cookie(
      AUTH_ROLE_COOKIE,
      createSignedRoleCookieValue(result.role),
      this.getCookieOptions(),
    );
    return { accessToken: result.accessToken };
  }

  /**
   * POST /auth/logout
   * Faz logout do usuário
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer logout' })
  @ApiResponse({
    status: 200,
    description: 'Logout bem-sucedido',
    schema: { properties: { message: { type: 'string' } } },
  })
  async logout(
    @Body() dto: RefreshDto,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    logStructured('info', 'AuthController', 'auth.logout.request', {
      hasBodyToken: Boolean(dto.refreshToken?.trim()),
    });

    const refreshToken = this.resolveRefreshToken(dto, req);
    await this.authService.logout(refreshToken ?? '');
    this.clearAuthCookies(res);
    return { message: 'Logout successful' };
  }

  /**
   * GET /auth/me
   * Retorna usuário autenticado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter usuário autenticado' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Usuário autenticado retornado com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido ou expirado',
  })
  async me(@Request() req: AuthenticatedRequest) {
    logStructured('info', 'AuthController', 'auth.me.request', {
      userId: req.user?.id,
      role: req.user?.role,
    });

    return this.authService.getCurrentUser(req.user!.id);
  }
}
