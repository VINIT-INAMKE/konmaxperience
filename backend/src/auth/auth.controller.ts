import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function getCookieDomain(): string | undefined {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) return undefined;
  try {
    const hostname = new URL(frontendUrl).hostname;
    // Strip www. prefix and prepend dot for subdomain sharing
    const root = hostname.replace(/^www\./, '');
    // Don't set domain for localhost
    if (root === 'localhost' || root.startsWith('127.')) return undefined;
    return `.${root}`;
  } catch {
    return undefined;
  }
}

@Controller('auth')
export class AuthController {
  private readonly cookieDomain = getCookieDomain();

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    const result = await this.authService.login(user);

    // Set refresh token as httpOnly cookie
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });

    // Set access token as httpOnly cookie for Next.js middleware
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const refreshToken = (request as any).cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new refresh_token cookie (rotation)
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });

    // Set new access_token cookie
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      ...(this.cookieDomain && { domain: this.cookieDomain }),
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const refreshToken = (request as any).cookies?.refresh_token;
    if (refreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await this.authService.logout(tokenHash);
    }

    response.clearCookie('refresh_token', { path: '/auth', ...(this.cookieDomain && { domain: this.cookieDomain }) });
    response.clearCookie('access_token', { ...(this.cookieDomain && { domain: this.cookieDomain }) });

    return { message: 'Logged out' };
  }

  @Post('logout-all')
  async logoutAll(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const user = (request as any).user;
    await this.authService.logoutAll(user.id);

    response.clearCookie('refresh_token', { path: '/auth', ...(this.cookieDomain && { domain: this.cookieDomain }) });
    response.clearCookie('access_token', { ...(this.cookieDomain && { domain: this.cookieDomain }) });

    return { message: 'Logged out of all devices' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If an account exists, a reset link has been sent' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password reset successfully' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('set-password')
  async setPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.setPassword(dto.token, dto.password);
    return { message: 'Password set successfully' };
  }

  @Get('me')
  async getProfile(@Req() request: express.Request) {
    const user = (request as any).user;
    return this.authService.getProfile(user.id);
  }
}
