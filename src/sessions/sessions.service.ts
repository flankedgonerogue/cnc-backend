import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateChildProfileDto } from './dto/create-child-profile.dto';
import type { AssignSessionDto } from './dto/assign-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Therapist: create a child profile ──────────────────────────

  async createChildProfile(therapistUserId: string, dto: CreateChildProfileDto) {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash('changeme123', 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'CHILD',
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
        },
      });

      const childProfile = await tx.childProfile.create({
        data: {
          userId: user.id,
          therapistId: therapistProfile.id,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          interests: dto.interests ?? [],
          triggers: dto.triggers ?? [],
        },
      });

      return { user, childProfile };
    });

    return {
      id: result.childProfile.id,
      userId: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      dateOfBirth: result.childProfile.dateOfBirth,
      interests: result.childProfile.interests,
      triggers: result.childProfile.triggers,
    };
  }

  // ── Therapist: list their children ─────────────────────────────

  async listChildren(
    therapistUserId: string,
    pagination: { take?: number; skip?: number },
  ) {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    return this.prisma.childProfile.findMany({
      where: { therapistId: therapistProfile.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      take: pagination.take,
      skip: pagination.skip,
      orderBy: { id: 'desc' },
    });
  }

  // ── Therapist: assign a session ────────────────────────────────

  async assignSession(therapistUserId: string, dto: AssignSessionDto) {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    // Validate child belongs to this therapist
    const childProfile = await this.prisma.childProfile.findUnique({
      where: { id: dto.childProfileId },
      select: { id: true, therapistId: true },
    });

    if (!childProfile) {
      throw new NotFoundException('Child profile not found.');
    }

    if (childProfile.therapistId !== therapistProfile.id) {
      throw new ForbiddenException('This child is not assigned to you.');
    }

    // Validate template belongs to this therapist
    const template = await this.prisma.storyTemplate.findFirst({
      where: {
        id: dto.templateId,
        deletedAt: null,
        therapistId: therapistProfile.id,
      },
      select: { id: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found or not owned by you.');
    }

    const session = await this.prisma.session.create({
      data: {
        childId: dto.childProfileId,
        templateId: dto.templateId,
        status: 'ACTIVE',
      },
    });

    return {
      id: session.id,
      childId: session.childId,
      templateId: session.templateId,
      status: session.status,
      startedAt: session.startedAt,
    };
  }

  // ── Therapist: list sessions ───────────────────────────────────

  async listSessionsForTherapist(
    therapistUserId: string,
    filters: { childProfileId?: string; status?: string; take?: number; skip?: number },
  ) {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    const where: Record<string, unknown> = {
      child: { therapistId: therapistProfile.id },
    };

    if (filters.childProfileId) {
      where.childId = filters.childProfileId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.session.findMany({
      where,
      include: {
        child: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        template: {
          select: { targetBehavior: true, setting: true, mainCharacter: true },
        },
        _count: { select: { nodes: true } },
      },
      take: filters.take,
      skip: filters.skip,
      orderBy: { startedAt: 'desc' },
    });
  }

  // ── Child: list their sessions ─────────────────────────────────

  async listSessionsForChild(
    childUserId: string,
    filters: { status?: string; take?: number; skip?: number },
  ) {
    const childProfile = await this.prisma.childProfile.findUnique({
      where: { userId: childUserId },
      select: { id: true },
    });

    if (!childProfile) {
      throw new NotFoundException('Child profile not found.');
    }

    const where: Record<string, unknown> = {
      childId: childProfile.id,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.session.findMany({
      where,
      include: {
        template: {
          select: { targetBehavior: true, setting: true, mainCharacter: true },
        },
        _count: { select: { nodes: true } },
      },
      take: filters.take,
      skip: filters.skip,
      orderBy: { startedAt: 'desc' },
    });
  }

  // ── Session detail ─────────────────────────────────────────────

  async getSessionDetail(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        template: {
          select: { targetBehavior: true, setting: true, mainCharacter: true, emotionalTone: true },
        },
        child: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        nodes: {
          include: { choices: true },
          orderBy: { id: 'asc' },
        },
        interactions: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    return session;
  }
}
