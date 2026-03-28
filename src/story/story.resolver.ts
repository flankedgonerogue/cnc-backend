import { Resolver, Mutation, Query, Args, Context, Int } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { StoryService } from './story.service';
import {
  StoryNodeResponse,
  ContinueStoryResponse,
  SessionBehavioralAnalyticsResponse,
} from './entities/story.entity';
import type { StartStoryDto } from './dto/start-story.dto';
import type { ContinueStoryDto } from './dto/continue-story.dto';

@Resolver()
export class StoryResolver {
  constructor(private readonly storyService: StoryService) {}

  @Mutation(() => StoryNodeResponse, { name: 'startStory' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.THERAPIST, Role.CHILD)
  async startStory(
    @Args('sessionId') sessionId: string,
    @Context() context: any,
  ): Promise<StoryNodeResponse> {
    const userId = context.req.user.id;

    // Validate sessionId is provided
    if (!sessionId || sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }

    const dto: StartStoryDto = { sessionId };
    return this.storyService.startStory(userId, dto);
  }

  @Mutation(() => ContinueStoryResponse, { name: 'continueStory' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.THERAPIST, Role.CHILD)
  async continueStory(
    @Args('sessionId') sessionId: string,
    @Args('choiceId') choiceId: string,
    @Args('timeTakenMs', { type: () => Int }) timeTakenMs: number,
    @Context() context: any,
  ): Promise<ContinueStoryResponse> {
    const userId = context.req.user.id;

    // Validate inputs
    if (!sessionId || sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }

    if (!choiceId || choiceId.trim().length === 0) {
      throw new BadRequestException('choiceId is required');
    }

    if (typeof timeTakenMs !== 'number' || timeTakenMs < 0) {
      throw new BadRequestException('timeTakenMs must be a non-negative number');
    }

    const dto: ContinueStoryDto = { sessionId, choiceId, timeTakenMs };
    return this.storyService.continueStory(userId, dto);
  }

  @Query(() => SessionBehavioralAnalyticsResponse, {
    name: 'getSessionBehavioralAnalytics',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.THERAPIST, Role.CHILD)
  async getSessionBehavioralAnalytics(
    @Args('sessionId') sessionId: string,
    @Context() context: any,
  ): Promise<SessionBehavioralAnalyticsResponse> {
    // Validate sessionId
    if (!sessionId || sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }

    return this.storyService.getSessionBehavioralAnalytics(sessionId);
  }
}
