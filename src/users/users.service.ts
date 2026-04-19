import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  GuardianChildPairingStatus,
  Role,
  User as PrismaUser,
} from '../generated/prisma/client';
import { User } from './user.entity';
import { UpdateUserInput } from './dto/update-user.input';
import { CreateChildInput } from './dto/create-child.input';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const randomBytesAsync = promisify(randomBytes);

@Injectable()
export class UsersService {
  private readonly pairingTokenExpirationHours = 24;

  constructor(
    private prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private mapToUserEntity(
    user: PrismaUser & {
      therapistProfile?: any;
      guardianProfile?: any;
      childProfile?: any;
    },
  ): User {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash ?? undefined,
      role: user.role ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      displayName: user.displayName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      timezone: user.timezone ?? undefined,
      locale: user.locale ?? undefined,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt ?? undefined,
      passwordResetToken: user.passwordResetToken ?? undefined,
      passwordResetTokenExpiresAt:
        user.passwordResetTokenExpiresAt ?? undefined,
      emailVerified: user.emailVerified ?? undefined,
      therapistProfile: user.therapistProfile ?? undefined,
      guardianProfile: user.guardianProfile ?? undefined,
      childProfile: user.childProfile ?? undefined,
    };
  }

  async create(userData: {
    email: string;
    password?: string;
    role?: Role;
  }): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = userData.password
      ? await bcrypt.hash(userData.password, 10)
      : null;

    const created = await this.prisma.user.create({
      data: {
        email: userData.email,
        passwordHash: hashedPassword,
        role: userData.role ?? null,
      },
    });

    return this.mapToUserEntity(created);
  }

  async findByEmail(
    email: string,
    options?: { includeDeleted?: boolean },
  ): Promise<User | undefined> {
    const includeDeleted = options?.includeDeleted ?? false;
    const user = await this.prisma.user.findFirst({
      where: includeDeleted ? { email } : { email, deletedAt: null },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return user ? this.mapToUserEntity(user) : undefined;
  }

  async findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<User | undefined> {
    const includeDeleted = options?.includeDeleted ?? false;
    const user = await this.prisma.user.findFirst({
      where: includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return user ? this.mapToUserEntity(user) : undefined;
  }

  async findByProviderId(
    _provider: 'local' | 'google',
    _providerId: string,
  ): Promise<User | undefined> {
    void _provider;
    void _providerId;
    await Promise.resolve();
    throw new Error('Provider IDs are not stored on User records.');
  }

  async findAll(options?: { includeDeleted?: boolean }): Promise<User[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const users = await this.prisma.user.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async findTherapists(options?: {
    includeDeleted?: boolean;
  }): Promise<User[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const users = await this.prisma.user.findMany({
      where: includeDeleted
        ? { role: Role.THERAPIST }
        : { role: Role.THERAPIST, deletedAt: null },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async findAdmins(options?: { includeDeleted?: boolean }): Promise<User[]> {
    const includeDeleted = options?.includeDeleted ?? false;
    const users = await this.prisma.user.findMany({
      where: includeDeleted
        ? { role: Role.ADMIN }
        : { role: Role.ADMIN, deletedAt: null },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async updateUser(
    id: string,
    updateData: Partial<User> | UpdateUserInput,
  ): Promise<User> {
    if ('role' in updateData && updateData.role) {
      throw new Error('Role cannot be changed once set.');
    }

    const data: any = {};

    if (updateData.email) {
      data.email = updateData.email;
    }

    if ('passwordHash' in updateData && updateData.passwordHash !== undefined) {
      data.passwordHash = updateData.passwordHash ?? null;
    }

    if (updateData.firstName !== undefined)
      data.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) data.lastName = updateData.lastName;
    if (updateData.displayName !== undefined)
      data.displayName = updateData.displayName;
    if (updateData.avatarUrl !== undefined)
      data.avatarUrl = updateData.avatarUrl;
    if (updateData.timezone !== undefined) data.timezone = updateData.timezone;
    if (updateData.locale !== undefined) data.locale = updateData.locale;

    if (Object.keys(data).length === 0) {
      const existing = await this.prisma.user.findUnique({
        where: { id },
        include: {
          therapistProfile: true,
          guardianProfile: true,
          childProfile: true,
        },
      });
      if (!existing) {
        throw new Error('User not found');
      }
      return this.mapToUserEntity(existing);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });

    return this.mapToUserEntity(updated);
  }

  async initializeRole(
    userId: string,
    role: Role,
    therapistEmail?: string,
  ): Promise<User> {
    if (role === Role.THERAPIST || role === Role.ADMIN) {
      throw new Error('Therapist and admin roles cannot be assigned here.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role) {
      throw new ConflictException('Role has already been set.');
    }

    if (role === Role.CHILD) {
      if (!therapistEmail) {
        throw new BadRequestException(
          'therapistEmail is required when setting role to CHILD.',
        );
      }

      const therapistUser = await this.prisma.user.findFirst({
        where: { email: therapistEmail, deletedAt: null },
        include: { therapistProfile: true },
      });

      if (!therapistUser || !therapistUser.therapistProfile) {
        throw new NotFoundException(
          `Therapist with email ${therapistEmail} not found`,
        );
      }

      const updatedChild = await this.prisma.user.update({
        where: { id: userId },
        data: {
          role,
          childProfile: {
            create: {
              therapistId: therapistUser.therapistProfile.id,
            },
          },
        },
        include: {
          therapistProfile: true,
          guardianProfile: true,
          childProfile: true,
        },
      });

      return this.mapToUserEntity(updatedChild);
    }

    const updatedGuardian = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        guardianProfile: {
          create: {},
        },
      },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });

    return this.mapToUserEntity(updatedGuardian);
  }

  async createChildForGuardian(
    guardianUserId: string,
    input: CreateChildInput,
  ): Promise<User> {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { userId: guardianUserId },
    });
    if (!guardian) {
      throw new ForbiddenException('Guardian profile not found.');
    }

    const therapistUser = await this.prisma.user.findFirst({
      where: { email: input.therapistEmail, deletedAt: null },
      include: { therapistProfile: true },
    });
    if (!therapistUser || !therapistUser.therapistProfile) {
      throw new NotFoundException(
        `Therapist with email ${input.therapistEmail} not found.`,
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException(
        `User with email ${input.email} already exists.`,
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: Role.CHILD,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName:
          input.firstName || input.lastName
            ? `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim()
            : undefined,
        childProfile: {
          create: {
            therapistId: therapistUser.therapistProfile.id,
            guardianId: guardian.id,
          },
        },
      },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });

    return this.mapToUserEntity(user);
  }

  async findChildrenByGuardian(guardianUserId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        childProfile: {
          guardian: { userId: guardianUserId },
        },
      },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async requestPairingForExistingChild(
    guardianUserId: string,
    childEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { userId: guardianUserId },
    });
    if (!guardian) {
      throw new ForbiddenException('Guardian profile not found.');
    }

    const childUser = await this.prisma.user.findFirst({
      where: { email: childEmail, deletedAt: null, role: Role.CHILD },
      include: { childProfile: true },
    });
    if (!childUser || !childUser.childProfile) {
      throw new NotFoundException(
        `Child with email ${childEmail} was not found.`,
      );
    }

    if (childUser.childProfile.guardianId === guardian.id) {
      throw new ConflictException('Child is already linked to this guardian.');
    }

    const rawToken = (await randomBytesAsync(32)).toString('hex');
    const tokenHash = this.hashPairingToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.pairingTokenExpirationHours);

    await this.prisma.guardianChildPairingRequest.create({
      data: {
        guardianProfileId: guardian.id,
        childUserId: childUser.id,
        tokenHash,
        expiresAt,
        status: GuardianChildPairingStatus.PENDING,
      },
    });

    const confirmUrl = this.buildPairingConfirmUrl(rawToken);
    await this.emailService.sendGuardianPairingEmail(
      childUser.email,
      confirmUrl,
      expiresAt,
    );

    return {
      success: true,
      message: `Pairing request sent to ${childUser.email}.`,
    };
  }

  async confirmPairingToken(token: string): Promise<{ ok: boolean }> {
    const tokenHash = this.hashPairingToken(token);
    const request = await this.prisma.guardianChildPairingRequest.findUnique({
      where: { tokenHash },
      include: {
        childUser: {
          include: { childProfile: true },
        },
      },
    });

    if (!request || request.status !== GuardianChildPairingStatus.PENDING) {
      return { ok: false };
    }

    if (request.expiresAt < new Date()) {
      await this.prisma.guardianChildPairingRequest.update({
        where: { id: request.id },
        data: { status: GuardianChildPairingStatus.EXPIRED },
      });
      return { ok: false };
    }

    if (!request.childUser.childProfile) {
      return { ok: false };
    }

    await this.prisma.$transaction([
      this.prisma.childProfile.update({
        where: { userId: request.childUserId },
        data: { guardianId: request.guardianProfileId },
      }),
      this.prisma.guardianChildPairingRequest.update({
        where: { id: request.id },
        data: {
          status: GuardianChildPairingStatus.CONSUMED,
          consumedAt: new Date(),
        },
      }),
    ]);

    return { ok: true };
  }

  async findChildrenByTherapist(therapistUserId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        childProfile: {
          therapist: { userId: therapistUserId },
        },
      },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return users.map((user) => this.mapToUserEntity(user));
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Helper method to return user without password hash
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...result } = user;
    void _passwordHash;
    return result;
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Deterministic digest of the raw reset token for DB lookup.
   * Do not use bcrypt here: bcrypt uses a random salt per call, so hashing the
   * same token twice yields different strings and exact-match lookup fails.
   */
  hashResetToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  hashPairingToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  buildPairingConfirmUrl(token: string): string {
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      `http://localhost:${this.configService.get<string>('PORT', '3000')}`;
    const confirmUrl = new URL('/users/pairing/confirm', backendUrl);
    confirmUrl.searchParams.set('token', token);
    return confirmUrl.toString();
  }

  getPairingRedirectUrl(success: boolean): string {
    if (success) {
      return this.configService.get<string>(
        'FRONTEND_SUCCESSFUL_PAIRING_URL',
        this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001'),
      );
    }

    return this.configService.get<string>(
      'FRONTEND_ERROR_URL',
      this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001'),
    );
  }

  /**
   * Update password reset token for a user
   */
  async updatePasswordResetToken(
    userId: string,
    hashedToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Find user by reset token
   */
  async findByResetToken(hashedToken: string): Promise<User | undefined> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        deletedAt: null,
      },
      include: {
        therapistProfile: true,
        guardianProfile: true,
        childProfile: true,
      },
    });
    return user ? this.mapToUserEntity(user) : undefined;
  }

  /**
   * Update password and clear reset token
   */
  async updatePasswordAndClearResetToken(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });
  }
}
