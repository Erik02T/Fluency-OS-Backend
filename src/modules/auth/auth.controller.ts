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
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, RefreshDto, AuthResponseDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import type { Response } from 'express';
import {
  ADMIN_REFRESH_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    };
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
    const result = await this.authService.register(dto);
    res.cookie(
      ADMIN_REFRESH_COOKIE,
      result.refreshToken,
      this.getCookieOptions(),
    );
    return result;
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
    const result = await this.authService.login(dto);
    res.cookie(
      ADMIN_REFRESH_COOKIE,
      result.refreshToken,
      this.getCookieOptions(),
    );
    return result;
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
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.resolveRefreshToken(dto, req);
    return this.authService.refreshToken(refreshToken ?? '');
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
    const refreshToken = this.resolveRefreshToken(dto, req);
    await this.authService.logout(refreshToken ?? '');
    res.clearCookie(ADMIN_REFRESH_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
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
    return this.authService.getCurrentUser(req.user!.id);
  }
}
