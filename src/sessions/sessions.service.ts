import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoryService } from '../story/story.service';
import type { AssignSessionDto } from './dto/assign-session.dto';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storyService: StoryService,
  ) {}

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

    const sourceSessionWithStory = await this.prisma.session.findFirst({
      where: {
        childId: dto.childProfileId,
        templateId: dto.templateId,
        nodes: { some: {} },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    const session = await this.prisma.session.create({
      data: {
        childId: dto.childProfileId,
        templateId: dto.templateId,
        status: 'ACTIVE',
      },
    });

    if (sourceSessionWithStory) {
      this.logger.log(
        `Cloning story nodes from session ${sourceSessionWithStory.id} into new session ${session.id} (child ${dto.childProfileId}, template ${dto.templateId})`,
      );
      await this.cloneStoryNodesFromSession(
        sourceSessionWithStory.id,
        session.id,
      );
      try {
        await this.storyService.primeSessionCacheAfterStoryClone(session.id);
      } catch (error) {
        this.logger.error(
          `Failed to prime story cache for cloned session ${session.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    } else {
      this.logger.log(
        `Scheduling async opening story generation for session ${session.id}`,
      );
      void this.storyService
        .startStory(therapistUserId, { sessionId: session.id })
        .then(() => {
          this.logger.log(
            `Async opening story generation finished for session ${session.id}`,
          );
        })
        .catch((error) => {
          this.logger.error(
            `Async pre-generation of opening story failed for session ${session.id}`,
            error instanceof Error ? error.stack : error,
          );
        });
    }

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

  /**
   * Copy story nodes and choices from a source session. Does not copy interactions
   * or behavioral analytics; the new session records a fresh playthrough.
   */
  private async cloneStoryNodesFromSession(
    sourceSessionId: string,
    targetSessionId: string,
  ): Promise<void> {
    const nodes = await this.prisma.storyNode.findMany({
      where: { sessionId: sourceSessionId },
      orderBy: { id: 'asc' },
      include: { choices: { orderBy: { id: 'asc' } } },
    });

    if (nodes.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const node of nodes) {
        await tx.storyNode.create({
          data: {
            sessionId: targetSessionId,
            textContent: node.textContent,
            imageUrl: node.imageUrl,
            audioUrl: node.audioUrl,
            confidenceScore: node.confidenceScore,
            isApproved: node.isApproved,
            choices: {
              create: node.choices.map((c) => ({
                text: c.text,
                behavioralTag: c.behavioralTag,
              })),
            },
          },
        });
      }
    });
  }
}
