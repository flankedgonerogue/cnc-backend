import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User as PrismaUser } from '../generated/prisma/client';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private mapToUserEntity(user: PrismaUser): User {
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

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? this.mapToUserEntity(user) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.mapToUserEntity(user));
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    if (updateData.role) {
      throw new Error('Role cannot be changed once set.');
    }

    const data: { email?: string; passwordHash?: string | null } = {};

    if (updateData.email) {
      data.email = updateData.email;
    }

    if (updateData.passwordHash !== undefined) {
      data.passwordHash = updateData.passwordHash ?? null;
    }

    if (Object.keys(data).length === 0) {
      const existing = await this.prisma.user.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('User not found');
      }
      return this.mapToUserEntity(existing);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.mapToUserEntity(updated);
  }

  async initializeRole(userId: string, role: Role): Promise<User> {
    if (role === Role.THERAPIST) {
      throw new Error('Therapist role cannot be assigned here.');
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
    });
    if (!user) {
      throw new Error('User not found');
    }

    return this.mapToUserEntity(user);
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
}
