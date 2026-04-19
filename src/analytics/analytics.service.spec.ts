import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DashboardPeriod } from './enums/dashboard-period.enum';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService guardian child analytics', () => {
  const prisma = {
    guardianProfile: { findUnique: jest.fn() },
    childProfile: { findFirst: jest.fn() },
    behavioralAnalytics: { findMany: jest.fn() },
  } as any;

  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(prisma);
  });

  it('throws NotFound when guardian profile is missing', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.getGuardianChildAnalytics('guardian-user-1', {
        period: DashboardPeriod.MONTH,
        comparePrevious: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws Forbidden when child filter is not linked to guardian', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'gp-1' });
    prisma.childProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.getGuardianChildAnalytics('guardian-user-1', {
        period: DashboardPeriod.WEEK,
        comparePrevious: false,
        childProfileId: 'child-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns parent-safe payload with status labels', async () => {
    const now = new Date();
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'gp-1' });
    prisma.behavioralAnalytics.findMany.mockResolvedValue([
      {
        engagementScore: 0.82,
        avgNodeConfidenceScore: 0.7,
        flaggedForReview: false,
        positiveChoices: 7,
        totalChoices: 10,
        session: {
          childId: 'child-1',
          templateId: 'tpl-1',
          status: 'COMPLETED',
          startedAt: now,
          child: { user: { firstName: 'Alex', lastName: 'Doe' } },
          template: {
            id: 'tpl-1',
            targetBehavior: 'Turn-taking',
            setting: 'Park',
            mainCharacter: 'Sam',
          },
        },
      },
    ]);

    const result = await service.getGuardianChildAnalytics('guardian-user-1', {
      period: DashboardPeriod.MONTH,
      comparePrevious: false,
    });

    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.statusLabel).toBeDefined();
    expect(result.children[0]?.parentSummary).toBeDefined();
    expect(result.children[0]).not.toHaveProperty('byTemplate');
  });
});
