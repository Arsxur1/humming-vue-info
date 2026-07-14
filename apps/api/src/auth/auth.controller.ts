import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  verifyEmailSchema,
  type AcceptInviteDto,
  type ForgotPasswordDto,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
  type ResetPasswordDto,
  type TwoFactorCodeDto,
  type VerifyEmailDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { AuthGuard, type AuthenticatedUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  @Post('register')
  @RateLimit({ limit: 100, windowSec: 3600, name: 'auth:register' })
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit({ limit: 100, windowSec: 900, name: 'auth:login' })
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  // ---------- Сброс пароля ----------

  @Post('password/forgot')
  @HttpCode(200)
  @RateLimit({ limit: 5, windowSec: 3600, name: 'auth:password-forgot' })
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    // Всегда 200 — не раскрываем, существует ли аккаунт
    return { ok: true };
  }

  @Post('password/reset')
  @HttpCode(200)
  @RateLimit({ limit: 20, windowSec: 3600, name: 'auth:password-reset' })
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  // ---------- 2FA ----------

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupTwoFactor(user.id);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) dto: TwoFactorCodeDto,
  ) {
    await this.auth.enableTwoFactor(user.id, dto.code);
    return { enabled: true };
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) dto: TwoFactorCodeDto,
  ) {
    await this.auth.disableTwoFactor(user.id, dto.code);
    return { disabled: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getMe(user.id);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(acceptInviteSchema)) dto: AcceptInviteDto,
  ) {
    return this.workspaces.acceptInvite(dto.token, user);
  }
}
