import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { AnalyticsService } from './analytics.service';
import { DashboardPeriod } from './enums/dashboard-period.enum';
import { TherapistDashboardAnalyticsPayload } from './entities/dashboard.entity';

@Resolver()
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query(() => TherapistDashboardAnalyticsPayload, {
    name: 'therapistDashboardAnalytics',
    description:
      'Cross-session aggregates for the authenticated therapist: per-child trends, template effectiveness, optional comparison to the prior window.',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.THERAPIST)
  async therapistDashboardAnalytics(
    @Args('period', { type: () => DashboardPeriod }) period: DashboardPeriod,
    @Args('comparePrevious', { type: () => Boolean, nullable: true })
    comparePrevious: boolean | null,
    @Args('childProfileId', { type: () => String, nullable: true })
    childProfileId: string | undefined,
    @Args('templateId', { type: () => String, nullable: true })
    templateId: string | undefined,
    @Context() context: { req: { user: { id: string } } },
  ): Promise<TherapistDashboardAnalyticsPayload> {
    const userId = context.req.user.id;
    return this.analyticsService.getTherapistDashboard(userId, {
      period,
      comparePrevious: comparePrevious ?? false,
      childProfileId: childProfileId ?? undefined,
      templateId: templateId ?? undefined,
    });
  }
}
