import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, SessionStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTherapistDto } from './dto/create-therapist.dto';

type TherapistSummary = {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  clinicName?: string | null;
  licenseNumber?: string | null;
  specialization?: string | null;
  bio?: string | null;
  interventionThreshold?: number | null;
  activeChildCount: number;
};

type AdminStats = {
  userBaseByRole: Record<string, number>;
  totalUsers: number;
  sessionHealth: {
    averageConfidenceScore: number | null;
  };
  activeInterventionRate: {
    pausedForReviewCount: number;
  };
  storageUsage: {
    avatarCount: number;
    storyImageCount: number;
    storyAudioCount: number;
  };
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createTherapist(
    adminId: string,
    dto: CreateTherapistDto,
  ): Promise<TherapistSummary> {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            role: Role.THERAPIST,
            firstName: dto.firstName,
            lastName: dto.lastName,
            displayName: `${dto.firstName} ${dto.lastName}`.trim(),
          },
        });

        const profile = await tx.therapistProfile.create({
          data: {
            userId: user.id,
            clinicName: dto.clinicName,
            licenseNumber: dto.licenseNumber,
            specialization: dto.specialization,
            bio: dto.bio,
            interventionThreshold: dto.interventionThreshold,
          },
        });

        await tx.actionLog.create({
          data: {
            adminId,
            actionType: 'THERAPIST_CREATED',
            targetUserId: user.id,
          },
        });

        return { user, profile };
      });

      return {
        userId: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
        clinicName: result.profile.clinicName,
        licenseNumber: result.profile.licenseNumber,
        specialization: result.profile.specialization,
        bio: result.profile.bio,
        interventionThreshold: result.profile.interventionThreshold,
        activeChildCount: 0,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Therapist email or license number already exists.',
        );
      }
      throw error;
    }
  }

  async listTherapists(): Promise<TherapistSummary[]> {
    const therapists = await this.prisma.therapistProfile.findMany({
      where: {
        user: {
          role: Role.THERAPIST,
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        children: {
          where: {
            user: {
              deletedAt: null,
            },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
    });

    return therapists.map((therapist) => ({
      userId: therapist.user.id,
      email: therapist.user.email,
      firstName: therapist.user.firstName,
      lastName: therapist.user.lastName,
      displayName: therapist.user.displayName,
      avatarUrl: therapist.user.avatarUrl,
      createdAt: therapist.user.createdAt,
      updatedAt: therapist.user.updatedAt,
      clinicName: therapist.clinicName,
      licenseNumber: therapist.licenseNumber,
      specialization: therapist.specialization,
      bio: therapist.bio,
      interventionThreshold: therapist.interventionThreshold,
      activeChildCount: therapist.children.length,
    }));
  }

  async deprovisionTherapist(
    adminId: string,
    therapistUserId: string,
  ): Promise<{ userId: string; deletedAt: Date }> {
    const existing = await this.prisma.user.findFirst({
      where: { id: therapistUserId, role: Role.THERAPIST },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Therapist not found.');
    }

    if (existing.deletedAt) {
      return { userId: existing.id, deletedAt: existing.deletedAt };
    }

    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: therapistUserId },
        data: { deletedAt },
      }),
      this.prisma.actionLog.create({
        data: {
          adminId,
          actionType: 'THERAPIST_DELETED',
          targetUserId: therapistUserId,
        },
      }),
    ]);

    return { userId: therapistUserId, deletedAt };
  }

  async reprovisionTherapist(
    adminId: string,
    therapistUserId: string,
  ): Promise<{ userId: string; deletedAt: Date | null }> {
    const existing = await this.prisma.user.findFirst({
      where: { id: therapistUserId, role: Role.THERAPIST },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Therapist not found.');
    }

    if (!existing.deletedAt) {
      return { userId: existing.id, deletedAt: null };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: therapistUserId },
        data: { deletedAt: null },
      }),
      this.prisma.actionLog.create({
        data: {
          adminId,
          actionType: 'THERAPIST_REPROVISIONED',
          targetUserId: therapistUserId,
        },
      }),
    ]);

    return { userId: therapistUserId, deletedAt: null };
  }

  async getStats(): Promise<AdminStats> {
    const [
      usersByRole,
      confidenceAgg,
      pausedCount,
      avatarCount,
      imageCount,
      audioCount,
      sessionsByStatus,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.storyNode.aggregate({
        _avg: { confidenceScore: true },
      }),
      this.prisma.session.count({
        where: { status: SessionStatus.PAUSED_FOR_REVIEW },
      }),
      this.prisma.user.count({
        where: { avatarUrl: { not: null }, deletedAt: null },
      }),
      this.prisma.storyNode.count({
        where: { imageUrl: { not: null } },
      }),
      this.prisma.storyNode.count({
        where: { audioUrl: { not: null } },
      }),
      this.prisma.session.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const userBaseByRole = usersByRole.reduce<Record<string, number>>(
      (acc, row) => {
        const roleKey = row.role ?? 'UNASSIGNED';
        const count =
          typeof row._count === 'object' && row._count?._all !== undefined
            ? row._count._all
            : 0;
        acc[roleKey] = count;
        return acc;
      },
      {},
    );

    const totalUsers = Object.values(userBaseByRole).reduce(
      (sum, count) => sum + count,
      0,
    );

    const sessionStats = sessionsByStatus.reduce<Record<string, number>>(
      (acc, row) => {
        const statusKey = row.status ?? 'UNKNOWN';
        const count =
          typeof row._count === 'object' && row._count?._all !== undefined
            ? row._count._all
            : 0;
        acc[statusKey] = count;
        return acc;
      },
      {},
    );

    return {
      userBaseByRole,
      totalUsers,
      sessionHealth: {
        averageConfidenceScore: confidenceAgg._avg.confidenceScore ?? null,
      },
      activeInterventionRate: {
        pausedForReviewCount: pausedCount,
      },
      storageUsage: {
        avatarCount,
        storyImageCount: imageCount,
        storyAudioCount: audioCount,
      },
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<any[]>;
  }

  async getUserConnections() {
    const connections = await this.prisma.childProfile.findMany({
      where: { user: { deletedAt: null } },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
        therapist: {
          select: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
        guardian: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });

    return connections.map((child) => ({
      childId: child.id,
      childEmail: child.user.email,
      childName: child.user.displayName,
      therapistId: child.therapist.user.id,
      therapistEmail: child.therapist.user.email,
      therapistName: child.therapist.user.displayName,
      guardianId: child.guardian?.id ?? null,
      guardianEmail: child.guardian?.user?.email ?? null,
    })) as any[];
  }

  async getAllSessions() {
    const sessions = await this.prisma.session.findMany({
      include: {
        child: {
          include: { user: { select: { displayName: true } } },
        },
        template: { select: { targetBehavior: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      childId: session.childId,
      childName: session.child.user.displayName || 'Unknown',
      templateId: session.templateId,
      templateName: session.template.targetBehavior,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.startedAt,
    })) as any[];
  }

  async getSessionDetails(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        child: {
          include: { user: true, therapist: { include: { user: true } } },
        },
        template: true,
        nodes: {
          select: { confidenceScore: true },
        },
        interactions: {
          select: { id: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    const avgConfidence =
      session.nodes.length > 0
        ? session.nodes.reduce((sum, n) => sum + n.confidenceScore, 0) /
          session.nodes.length
        : 0;

    return {
      id: session.id,
      childId: session.childId,
      childName: session.child.user.displayName || 'Unknown',
      templateId: session.templateId,
      templateName: session.template.targetBehavior,
      therapistId: session.child.therapist.user.id,
      therapistName: session.child.therapist.user.displayName || 'Unknown',
      status: session.status,
      averageConfidenceScore: avgConfidence,
      totalInteractions: session.interactions.length,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    } as any;
  }

  async getAppStats() {
    const [users, sessions, sessionsByStatus, avgConfidence, storage] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['role'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.session.count(),
        this.prisma.session.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.storyNode.aggregate({
          _avg: { confidenceScore: true },
        }),
        Promise.all([
          this.prisma.user.count({
            where: { avatarUrl: { not: null }, deletedAt: null },
          }),
          this.prisma.storyNode.count({ where: { imageUrl: { not: null } } }),
          this.prisma.storyNode.count({ where: { audioUrl: { not: null } } }),
        ]),
      ]);

    const roleMap: Record<string, number> = {
      ADMIN: 0,
      THERAPIST: 0,
      GUARDIAN: 0,
      CHILD: 0,
      UNASSIGNED: 0,
    };

    users.forEach((row) => {
      const role = row.role ?? 'UNASSIGNED';
      const count =
        typeof row._count === 'object' && row._count?._all !== undefined
          ? row._count._all
          : 0;
      if (role in roleMap) {
        roleMap[role] = count;
      }
    });

    const statusMap: Record<string, number> = {
      ACTIVE: 0,
      PAUSED_FOR_REVIEW: 0,
      COMPLETED: 0,
    };

    sessionsByStatus.forEach((row) => {
      const status = row.status ?? 'UNKNOWN';
      const count =
        typeof row._count === 'object' && row._count?._all !== undefined
          ? row._count._all
          : 0;
      if (status in statusMap) {
        statusMap[status] = count;
      }
    });

    const totalUsers = Object.values(roleMap).reduce((a, b) => a + b, 0);

    return {
      totalUsers,
      adminCount: roleMap.ADMIN,
      therapistCount: roleMap.THERAPIST,
      guardianCount: roleMap.GUARDIAN,
      childCount: roleMap.CHILD,
      unassignedUserCount: roleMap.UNASSIGNED,
      totalSessions: sessions,
      activeSessions: statusMap.ACTIVE,
      completedSessions: statusMap.COMPLETED,
      pausedSessions: statusMap.PAUSED_FOR_REVIEW,
      averageSessionConfidenceScore: avgConfidence._avg.confidenceScore ?? 0,
      pausedForReviewCount: statusMap.PAUSED_FOR_REVIEW,
      storageUsage: {
        avatarCount: storage[0],
        storyImageCount: storage[1],
        storyAudioCount: storage[2],
      },
    };
  }
}
