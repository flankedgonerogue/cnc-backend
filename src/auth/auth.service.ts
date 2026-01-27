import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Role } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
}
