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
}
