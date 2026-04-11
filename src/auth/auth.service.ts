import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/user.entity';
import { Role } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

@Injectable()
export class AuthService {
  private readonly resetTokenExpirationHours = 1;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  /**
   * Validate user credentials for local authentication
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email, {
      includeDeleted: true,
    });

    if (!user) {
      return null;
    }

    if (user.deletedAt) {
      throw new UnauthorizedException(
        'This account has been deactivated. Please contact support.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account is registered without a password. Please use Google to sign in.',
      );
    }

    const isPasswordValid = await this.usersService.validatePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    return this.usersService.sanitizeUser(user);
  }

  /**
   * Validate or create OAuth user
   */
  async validateOAuthUser(profile: { email: string }): Promise<User> {
    const { user } = await this.validateOAuthUserWithStatus(profile);
    return user;
  }

  async validateOAuthUserWithStatus(profile: {
    email: string;
  }): Promise<{ user: User; isNew: boolean }> {
    let user = await this.usersService.findByEmail(profile.email, {
      includeDeleted: true,
    });

    if (user) {
      if (user.deletedAt) {
        throw new UnauthorizedException(
          'This account has been deactivated. Please contact support.',
        );
      }

      if (user.passwordHash) {
        throw new UnauthorizedException(
          'This email is already registered with a password. Please use email and password to sign in.',
        );
      }

      return { user, isNew: false };
    }

    user = await this.usersService.create({
      email: profile.email,
    });

    return { user, isNew: true };
  }

  async initializeRole(
    userId: string,
    role: Role,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (role === Role.THERAPIST || role === Role.ADMIN) {
      throw new UnauthorizedException(
        'Therapist and admin roles cannot be assigned via this flow.',
      );
    }

    const user = await this.usersService.initializeRole(userId, role);
    return this.usersService.sanitizeUser(user);
  }

  /**
   * Register new user with email and password
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ access_token: string; user: Omit<User, 'passwordHash'> }> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(
      registerDto.email,
      { includeDeleted: true },
    );

    if (existingUser) {
      const conflictMessage = existingUser.passwordHash
        ? 'This email is already registered with a password.'
        : 'This email is already registered via Google.';
      throw new ConflictException(
        `User with email ${registerDto.email} already exists. ${conflictMessage}`,
      );
    }

    if (
      registerDto.role === Role.THERAPIST ||
      registerDto.role === Role.ADMIN
    ) {
      throw new UnauthorizedException(
        'Therapist and admin roles cannot be assigned via registration.',
      );
    }

    // Create new user
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      role: registerDto.role,
    });

    const sanitizedUser = this.usersService.sanitizeUser(user);
    const accessToken = this.generateToken(user);

    return {
      access_token: accessToken,
      user: sanitizedUser,
    };
  }

  /**
   * Login with email and password
   */
  login(user: User): {
    access_token: string;
    user: Omit<User, 'passwordHash'>;
  } {
    const sanitizedUser = this.usersService.sanitizeUser(user);
    const accessToken = this.generateToken(user);

    return {
      access_token: accessToken,
      user: sanitizedUser,
    };
  }

  /**
   * Generate JWT token
   */
  generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.usersService.sanitizeUser(user);
  }

  /**
   * Request password reset - generates token, saves to DB, sends email
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email, {
      includeDeleted: true,
    });

    // Don't leak whether email exists (security best practice)
    if (!user || user.deletedAt || !user.passwordHash) {
      return {
        message:
          'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate cryptographically secure reset token
    const token = (await randomBytesAsync(32)).toString('hex');
    const hashedToken = await this.usersService.hashPassword(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.resetTokenExpirationHours);

    // Save token to database
    await this.usersService.updatePasswordResetToken(
      user.id,
      hashedToken,
      expiresAt,
    );

    // Build reset URL
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    // Send email
    try {
      await this.emailService.sendPasswordResetEmail(
        email,
        token,
        resetUrl,
      );
    } catch (error) {
      // Log error but don't expose to user
      console.error('Failed to send password reset email:', error);
    }

    return {
      message:
        'If an account exists with this email, a password reset link has been sent.',
    };
  }

  /**
   * Validate reset token without using it
   */
  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const hashedToken = await this.usersService.hashPassword(token);

    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user || !user.passwordResetTokenExpiresAt) {
      return { valid: false };
    }

    // Check if token has expired
    if (user.passwordResetTokenExpiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true };
  }

  /**
   * Reset password with valid token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    const hashedToken = await this.usersService.hashPassword(token);

    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user || !user.passwordResetTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token has expired
    if (user.passwordResetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Password reset link has expired');
    }

    // Hash new password and update user
    const passwordHash = await this.usersService.hashPassword(newPassword);
    await this.usersService.updatePasswordAndClearResetToken(
      user.id,
      passwordHash,
    );

    return { message: 'Password has been successfully reset' };
  }
}
