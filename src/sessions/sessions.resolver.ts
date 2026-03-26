import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SessionAccessGuard } from './guards/session-access.guard';
import { SessionsService } from './sessions.service';
import { AssignSessionDto } from './dto/assign-session.dto';
import { Session } from './session.entity';

@Resolver(() => Session)
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsResolver {
  constructor(private readonly sessionsService: SessionsService) {}

  @Mutation(() => Session)
  @Roles(Role.THERAPIST)
  async assignSession(
    @Args('assignSessionInput') input: AssignSessionDto,
    @Context() context: any,
  ) {
    const userId = context.req.user.id;
    return this.sessionsService.assignSession(userId, input);
  }

  @Query(() => [Session])
  @Roles(Role.THERAPIST)
  async listSessions(
    @Context() context: any,
    @Args('childProfileId', { nullable: true }) childProfileId?: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    const userId = context.req.user.id;
    return this.sessionsService.listSessionsForTherapist(userId, {
      childProfileId,
      status,
      take: this.parsePositiveInt(take, 20),
      skip: this.parsePositiveInt(skip, 0),
    });
  }

  @Query(() => [Session])
  @Roles(Role.CHILD)
  async mySessions(
    @Context() context: any,
    @Args('status', { nullable: true }) status?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    const userId = context.req.user.id;
    return this.sessionsService.listSessionsForChild(userId, {
      status,
      take: this.parsePositiveInt(take, 20),
      skip: this.parsePositiveInt(skip, 0),
    });
  }

  @Query(() => Session)
  @Roles(Role.THERAPIST, Role.CHILD)
  @UseGuards(SessionAccessGuard)
  async session(@Args('id') id: string) {
    return this.sessionsService.getSessionDetail(id);
  }

  private parsePositiveInt(
    value: number | string | undefined,
    fallback: number,
  ): number {
    if (value === undefined || value === null) return fallback;
    const parsed =
      typeof value === 'number' ? value : Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.min(parsed, 100)
      : fallback;
  }
}
