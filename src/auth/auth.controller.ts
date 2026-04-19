import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ValidateResetTokenDto } from './dto/validate-reset-token.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { User } from '../users/user.entity';

type AuthRequest = ExpressRequest & { user: User };
type GoogleAuthUser = User & { isNew?: boolean };
type GoogleAuthRequest = ExpressRequest & { user: GoogleAuthUser };

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user with email and password
   * POST /auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Request() req: AuthRequest, @Body() loginDto: LoginDto) {
    // LocalAuthGuard validates credentials and attaches user to request
    void loginDto;
    return this.authService.login(req.user);
  }

  /**
   * Get current user profile (protected route)
   * GET /auth/profile
   * Requires: Bearer token in Authorization header
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Initiate Google OAuth login
   * GET /auth/google
   * Redirects to Google's OAuth consent screen
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  /**
   * Google OAuth callback
   * GET /auth/google/callback
   * Google redirects here after user grants permission
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(
    @Request() req: GoogleAuthRequest,
    @Res() res: ExpressResponse,
  ) {
    // GoogleAuthGuard validates OAuth token and attaches user to request
    const { isNew, ...user } = req.user;
    const result = this.authService.login(user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    // Default behavior for browser-based OAuth: redirect back to frontend.
    // We use the URL fragment to avoid putting tokens in server logs/query params.
    if (frontendUrl) {
      const callbackUrl = new URL('/auth/callback', frontendUrl);
      callbackUrl.hash = new URLSearchParams({
        access_token: result.access_token,
        isNew: String(!!isNew),
        roleRequired: String(!user.role),
      }).toString();
      return res.redirect(callbackUrl.toString());
    }

    // Fallback for API clients / missing FRONTEND_URL.
    return res.json({
      ...result,
      isNew: !!isNew,
      roleRequired: !user.role,
      message: 'Google authentication successful',
    });
  }

  /**
   * Initialize role for OAuth users (one-time)
   * POST /auth/oauth/role
   * Requires: Bearer token in Authorization header
   */
  @UseGuards(JwtAuthGuard)
  @Post('oauth/role')
  @HttpCode(HttpStatus.OK)
  async setOAuthRole(
    @Request() req: AuthRequest,
    @Body() setRoleDto: SetRoleDto,
  ) {
    return this.authService.initializeRole(
      req.user.id,
      setRoleDto.role,
      setRoleDto.therapistEmail,
    );
  }

  /**
   * Test endpoint to verify JWT token
   * GET /auth/verify
   * Requires: Bearer token in Authorization header
   */
  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verifyToken(@Request() req: AuthRequest) {
    await Promise.resolve();
    return {
      valid: true,
      user: req.user,
    };
  }

  /**
   * Request password reset
   * POST /auth/password-reset/request
   */
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    return this.authService.requestPasswordReset(requestPasswordResetDto.email);
  }

  /**
   * Validate password reset token
   * POST /auth/password-reset/validate
   */
  @Post('password-reset/validate')
  @HttpCode(HttpStatus.OK)
  async validateResetToken(
    @Body() validateResetTokenDto: ValidateResetTokenDto,
  ) {
    return this.authService.validateResetToken(validateResetTokenDto.token);
  }

  /**
   * Reset password with token
   * POST /auth/password-reset/confirm
   */
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
}
