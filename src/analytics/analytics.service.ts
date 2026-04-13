import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardPeriod } from './enums/dashboard-period.enum';
import type { BehavioralAnalytics, Session } from '../generated/prisma/client';
import type {
  ChildDashboardRow,
  ChildTrendPoint,
  DashboardComparison,
  DashboardSummaryMetrics,
  TemplateDashboardRow,
  TherapistDashboardAnalyticsPayload,
  AnalyticsPeriodWindow,
} from './entities/dashboard.entity';

type SessionWithRelations = Session & {
  child: {
    id: string;
    user: { firstName: string | null; lastName: string | null } | null;
  };
  template: {
    id: string;
    targetBehavior: string;
    setting: string;
    mainCharacter: string;
  };
};

type AnalyticsRow = BehavioralAnalytics & { session: SessionWithRelations };

const MS_DAY = 86_400_000;
const WEEK_MS = 7 * MS_DAY;
const MONTH_MS = 30 * MS_DAY;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  getTimeWindows(
    period: DashboardPeriod,
    now: Date = new Date(),
  ): { current: AnalyticsPeriodWindow; previous: AnalyticsPeriodWindow } {
    const currentEnd = now;
    const span = period === DashboardPeriod.WEEK ? WEEK_MS : MONTH_MS;
    const currentStart = new Date(currentEnd.getTime() - span);
    const previousEnd = currentStart;
    const previousStart = new Date(previousEnd.getTime() - span);

    return {
      current: { start: currentStart, end: currentEnd },
      previous: { start: previousStart, end: previousEnd },
    };
  }

  async getTherapistDashboard(
    therapistUserId: string,
    options: {
      period: DashboardPeriod;
      comparePrevious: boolean;
      childProfileId?: string;
      templateId?: string;
    },
  ): Promise<TherapistDashboardAnalyticsPayload> {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    const tpId = therapistProfile.id;

    if (options.childProfileId) {
      const child = await this.prisma.childProfile.findFirst({
        where: { id: options.childProfileId, therapistId: tpId },
        select: { id: true },
      });
      if (!child) {
        throw new ForbiddenException('This child is not assigned to you.');
      }
    }

    if (options.templateId) {
      const template = await this.prisma.storyTemplate.findFirst({
        where: {
          id: options.templateId,
          therapistId: tpId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!template) {
        throw new ForbiddenException('Template not found or not owned by you.');
      }
    }

    const { current, previous } = this.getTimeWindows(options.period);

    const currentRows = await this.fetchAnalyticsRows(tpId, current, options);
    const previousRows = options.comparePrevious
      ? await this.fetchAnalyticsRows(tpId, previous, options)
      : [];

    const currentSummary = this.summarizeRows(currentRows);
    const previousSummary = this.summarizeRows(previousRows);

    const summary: DashboardComparison = {
      current: currentSummary,
      previous: options.comparePrevious ? previousSummary : null,
      avgEngagementScoreDeltaPercent: options.comparePrevious
        ? this.deltaPercent(
            currentSummary.avgEngagementScore,
            previousSummary.avgEngagementScore,
          )
        : null,
      sessionCountDeltaPercent: options.comparePrevious
        ? this.deltaPercent(
            currentSummary.sessionCount,
            previousSummary.sessionCount,
          )
        : null,
    };

    const byChild = this.buildByChild(
      currentRows,
      previousRows,
      options.comparePrevious,
      options.period,
      current,
    );

    const byTemplate = this.buildByTemplate(
      currentRows,
      previousRows,
      options.comparePrevious,
    );

    return {
      period: options.period,
      currentWindow: current,
      previousWindow: options.comparePrevious ? previous : null,
      summary,
      byChild,
      byTemplate,
    };
  }

  private async fetchAnalyticsRows(
    therapistProfileId: string,
    window: AnalyticsPeriodWindow,
    options: {
      childProfileId?: string;
      templateId?: string;
    },
  ): Promise<AnalyticsRow[]> {
    const rows = await this.prisma.behavioralAnalytics.findMany({
      where: {
        session: {
          child: { therapistId: therapistProfileId },
          startedAt: {
            gte: window.start,
            lt: window.end,
          },
          ...(options.childProfileId
            ? { childId: options.childProfileId }
            : {}),
          ...(options.templateId ? { templateId: options.templateId } : {}),
        },
      },
      include: {
        session: {
          include: {
            child: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            template: {
              select: {
                id: true,
                targetBehavior: true,
                setting: true,
                mainCharacter: true,
              },
            },
          },
        },
      },
    });

    return rows as AnalyticsRow[];
  }

  private summarizeRows(rows: AnalyticsRow[]): DashboardSummaryMetrics {
    if (rows.length === 0) {
      return {
        sessionCount: 0,
        avgEngagementScore: 0,
        avgNodeConfidenceScore: 0,
        flaggedSessionCount: 0,
        weightedPositiveChoiceRatio: 0,
      };
    }

    const sumEng = rows.reduce((s, r) => s + r.engagementScore, 0);
    const sumConf = rows.reduce((s, r) => s + r.avgNodeConfidenceScore, 0);
    const flagged = rows.filter((r) => r.flaggedForReview).length;
    const pos = rows.reduce((s, r) => s + r.positiveChoices, 0);
    const tot = rows.reduce((s, r) => s + r.totalChoices, 0);

    return {
      sessionCount: rows.length,
      avgEngagementScore: sumEng / rows.length,
      avgNodeConfidenceScore: sumConf / rows.length,
      flaggedSessionCount: flagged,
      weightedPositiveChoiceRatio: tot > 0 ? pos / tot : 0,
    };
  }

  private buildByChild(
    currentRows: AnalyticsRow[],
    previousRows: AnalyticsRow[],
    comparePrevious: boolean,
    period: DashboardPeriod,
    currentWindow: AnalyticsPeriodWindow,
  ): ChildDashboardRow[] {
    const prevByChild = new Map<string, AnalyticsRow[]>();
    if (comparePrevious) {
      for (const r of previousRows) {
        const id = r.session.childId;
        const list = prevByChild.get(id) ?? [];
        list.push(r);
        prevByChild.set(id, list);
      }
    }

    const byChild = new Map<string, AnalyticsRow[]>();
    for (const r of currentRows) {
      const id = r.session.childId;
      const list = byChild.get(id) ?? [];
      list.push(r);
      byChild.set(id, list);
    }

    const result: ChildDashboardRow[] = [];

    for (const [childId, rows] of byChild) {
      const summary = this.summarizeRows(rows);
      const prevList = prevByChild.get(childId);
      const prevSummary = prevList?.length
        ? this.summarizeRows(prevList)
        : null;

      const user = rows[0]?.session.child.user;
      const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        null;

      const trendPoints = this.buildChildTrendPoints(
        rows,
        period,
        currentWindow,
      );

      result.push({
        childProfileId: childId,
        displayName,
        sessionCount: summary.sessionCount,
        avgEngagementScore: summary.avgEngagementScore,
        weightedPositiveChoiceRatio: summary.weightedPositiveChoiceRatio,
        previousAvgEngagementScore: prevSummary?.avgEngagementScore ?? null,
        engagementScoreDeltaPercent:
          comparePrevious && prevSummary
            ? this.deltaPercent(
                summary.avgEngagementScore,
                prevSummary.avgEngagementScore,
              )
            : null,
        trendPoints,
      });
    }

    result.sort((a, b) => b.avgEngagementScore - a.avgEngagementScore);
    return result;
  }

  private buildChildTrendPoints(
    rows: AnalyticsRow[],
    period: DashboardPeriod,
    window: AnalyticsPeriodWindow,
  ): ChildTrendPoint[] {
    const bucketCount = period === DashboardPeriod.WEEK ? 7 : 4;
    const duration = window.end.getTime() - window.start.getTime();
    const step = duration / bucketCount;
    const points: ChildTrendPoint[] = [];

    for (let i = 0; i < bucketCount; i += 1) {
      const bucketStart = new Date(window.start.getTime() + i * step);
      const bucketEnd = new Date(window.start.getTime() + (i + 1) * step);
      const inBucket = rows.filter((r) => {
        const t = r.session.startedAt.getTime();
        return t >= bucketStart.getTime() && t < bucketEnd.getTime();
      });
      const s = this.summarizeRows(inBucket);
      points.push({
        bucketStart,
        bucketEnd,
        avgEngagementScore: s.avgEngagementScore,
        sessionCount: s.sessionCount,
      });
    }

    return points;
  }

  private buildByTemplate(
    currentRows: AnalyticsRow[],
    previousRows: AnalyticsRow[],
    comparePrevious: boolean,
  ): TemplateDashboardRow[] {
    const prevByTpl = new Map<string, AnalyticsRow[]>();
    if (comparePrevious) {
      for (const r of previousRows) {
        const id = r.session.templateId;
        const list = prevByTpl.get(id) ?? [];
        list.push(r);
        prevByTpl.set(id, list);
      }
    }

    const byTpl = new Map<string, AnalyticsRow[]>();
    for (const r of currentRows) {
      const id = r.session.templateId;
      const list = byTpl.get(id) ?? [];
      list.push(r);
      byTpl.set(id, list);
    }

    const result: TemplateDashboardRow[] = [];

    for (const [templateId, rows] of byTpl) {
      const summary = this.summarizeRows(rows);
      const prevList = prevByTpl.get(templateId);
      const prevSummary = prevList?.length
        ? this.summarizeRows(prevList)
        : null;

      const completed = rows.filter(
        (r) => r.session.status === SessionStatus.COMPLETED,
      ).length;
      const completionRate =
        rows.length > 0 ? completed / rows.length : 0;

      const t = rows[0]!.session.template;

      result.push({
        templateId,
        targetBehavior: t.targetBehavior,
        setting: t.setting,
        mainCharacter: t.mainCharacter,
        sessionCount: summary.sessionCount,
        avgEngagementScore: summary.avgEngagementScore,
        weightedPositiveChoiceRatio: summary.weightedPositiveChoiceRatio,
        completionRate,
        previousAvgEngagementScore: prevSummary?.avgEngagementScore ?? null,
        engagementScoreDeltaPercent:
          comparePrevious && prevSummary
            ? this.deltaPercent(
                summary.avgEngagementScore,
                prevSummary.avgEngagementScore,
              )
            : null,
      });
    }

    result.sort((a, b) => b.sessionCount - a.sessionCount);
    return result;
  }

  private deltaPercent(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return ((current - previous) / previous) * 100;
  }
}
