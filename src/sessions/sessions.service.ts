import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignSessionDto } from './dto/assign-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

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
    filters: {
      childProfileId?: string;
      status?: string;
      take?: number;
      skip?: number;
    },
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
        template: true,
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
        template: true,
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
        template: true,
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
