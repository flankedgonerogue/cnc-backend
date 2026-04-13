import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ValidateResetTokenDto } from './dto/validate-reset-token.dto';
import {
  AuthResponse,
  VerifyResponse,
  PasswordResetResponse,
  ValidateResetTokenResponse,
} from './dto/auth.type';
import { User } from '../users/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  private mapUserToAuth(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...result } = user;
    void _passwordHash;
    return result;
  }

  @Mutation(() => AuthResponse, { name: 'register' })
  async register(@Args('registerInput') registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Mutation(() => AuthResponse, { name: 'login' })
  async login(@Args('loginInput') loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user as User);
  }

  @Query(() => User, { name: 'profile' })
  @UseGuards(JwtAuthGuard)
  async getProfile(@Context() context: Record<string, any>) {
    // Assuming JwtAuthGuard attaches the user to context.req.user
    // Note: You may need to adapt JwtAuthGuard to use GqlExecutionContext for GraphQL
    const userId = context.req.user.id as string;
    const user = await this.authService.getProfile(userId);
    return this.mapUserToAuth(user);
  }

  @Mutation(() => User, { name: 'setOAuthRole' })
  @UseGuards(JwtAuthGuard)
  async setOAuthRole(
    @Args('setRoleInput') setRoleDto: SetRoleDto,
    @Context() context: Record<string, any>,
  ) {
    const userId = context.req.user.id as string;
    const user = await this.authService.initializeRole(userId, setRoleDto.role);
    return this.mapUserToAuth(user);
  }

  @Query(() => VerifyResponse, { name: 'verifyToken' })
  @UseGuards(JwtAuthGuard)
  async verifyToken(@Context() context: Record<string, any>) {
    return {
      valid: true,
      user: this.mapUserToAuth(context.req.user as User),
    };
  }

  @Mutation(() => PasswordResetResponse, { name: 'requestPasswordReset' })
  async requestPasswordReset(
    @Args('requestInput') requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    return this.authService.requestPasswordReset(requestPasswordResetDto.email);
  }

  @Mutation(() => ValidateResetTokenResponse, { name: 'validateResetToken' })
  async validateResetToken(
    @Args('validateInput') validateResetTokenDto: ValidateResetTokenDto,
  ) {
    return this.authService.validateResetToken(validateResetTokenDto.token);
  }

  @Mutation(() => PasswordResetResponse, { name: 'resetPassword' })
  async resetPassword(@Args('resetInput') resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
}
