import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RefreshSchema,
  ResetPasswordSchema,
  SignupSchema,
  VerifyEmailSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RefreshInput,
  type ResetPasswordInput,
  type SignupInput,
  type VerifyEmailInput,
} from '@smtp/shared';
import { ZodValidationPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, type AuthUser } from './decorators/current-user.decorator';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(
    @Body(new ZodValidationPipe(SignupSchema)) input: SignupInput,
    @Req() req: Request,
  ) {
    return this.auth.signup(input, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(LoginSchema)) input: LoginInput,
    @Req() req: Request,
  ) {
    return this.auth.login(input, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) input: RefreshInput) {
    return this.auth.refresh(input);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) input: VerifyEmailInput) {
    await this.auth.verifyEmail(input);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) input: ForgotPasswordInput,
  ) {
    await this.auth.forgotPassword(input);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) input: ResetPasswordInput,
  ) {
    await this.auth.resetPassword(input);
  }
}
