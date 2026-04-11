import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User as PrismaUser } from '../generated/prisma/client';
import { User } from './user.entity';
import { UpdateUserInput } from './dto/update-user.input';
import { CreateChildInput } from './dto/create-child.input';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
      passwordResetTokenExpiresAt: user.passwordResetTokenExpiresAt ?? undefined,
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

  async findTherapists(options?: { includeDeleted?: boolean }): Promise<User[]> {
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

  async initializeRole(userId: string, role: Role): Promise<User> {
    if (role === Role.THERAPIST || role === Role.ADMIN) {
      throw new Error('Therapist and admin roles cannot be assigned here.');
    }

    const updated = await this.prisma.user.updateMany({
      where: { id: userId, role: null },
      data: { role },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!existing) {
        throw new Error('User not found');
      }
      if (existing.role) {
        throw new ConflictException('Role has already been set.');
      }
      throw new Error('Unable to set role.');
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
      throw new Error('User not found');
    }

    return this.mapToUserEntity(user);
  }

  async createChildForGuardian(
    guardianUserId: string,
    input: CreateChildInput,
  ): Promise<User> {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { userId: guardianUserId },
      include: { child: true },
    });
    if (!guardian) {
      throw new ForbiddenException('Guardian profile not found.');
    }
    if (guardian.child) {
      throw new ConflictException('Guardian already has an assigned child.');
    }

    const therapist = await this.prisma.therapistProfile.findUnique({
      where: { id: input.therapistId },
    });
    if (!therapist) {
      throw new NotFoundException('Therapist not found.');
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException(`User with email ${input.email} already exists.`);
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
            therapistId: input.therapistId,
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

  async findChildByGuardian(guardianUserId: string): Promise<User | undefined> {
    const user = await this.prisma.user.findFirst({
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
    return user ? this.mapToUserEntity(user) : undefined;
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
