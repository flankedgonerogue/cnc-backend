import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { DashboardPeriod } from '../enums/dashboard-period.enum';

@ObjectType()
export class AnalyticsPeriodWindow {
  @Field(() => Date)
  start: Date;

  @Field(() => Date)
  end: Date;
}

@ObjectType()
export class DashboardSummaryMetrics {
  @Field(() => Int)
  sessionCount: number;

  @Field(() => Float)
  avgEngagementScore: number;

  @Field(() => Float)
  avgNodeConfidenceScore: number;

  @Field(() => Int)
  flaggedSessionCount: number;

  /** Sum(positiveChoices) / sum(totalChoices), 0 if no choices recorded */
  @Field(() => Float)
  weightedPositiveChoiceRatio: number;
}

@ObjectType()
export class DashboardComparison {
  @Field(() => DashboardSummaryMetrics)
  current: DashboardSummaryMetrics;

  @Field(() => DashboardSummaryMetrics, { nullable: true })
  previous: DashboardSummaryMetrics | null;

  /** e.g. engagement: ((current - previous) / previous) * 100; null if not comparable */
  @Field(() => Float, { nullable: true })
  avgEngagementScoreDeltaPercent: number | null;

  @Field(() => Float, { nullable: true })
  sessionCountDeltaPercent: number | null;
}

@ObjectType()
export class ChildTrendPoint {
  @Field(() => Date)
  bucketStart: Date;

  @Field(() => Date)
  bucketEnd: Date;

  @Field(() => Float)
  avgEngagementScore: number;

  @Field(() => Int)
  sessionCount: number;
}

@ObjectType()
export class ChildDashboardRow {
  @Field(() => ID)
  childProfileId: string;

  @Field(() => String, { nullable: true })
  displayName: string | null;

  @Field(() => Int)
  sessionCount: number;

  @Field(() => Float)
  avgEngagementScore: number;

  @Field(() => Float)
  weightedPositiveChoiceRatio: number;

  @Field(() => Float, { nullable: true })
  previousAvgEngagementScore: number | null;

  @Field(() => Float, { nullable: true })
  engagementScoreDeltaPercent: number | null;

  @Field(() => [ChildTrendPoint])
  trendPoints: ChildTrendPoint[];
}

@ObjectType()
export class TemplateDashboardRow {
  @Field(() => ID)
  templateId: string;

  @Field(() => String)
  targetBehavior: string;

  @Field(() => String)
  setting: string;

  @Field(() => String)
  mainCharacter: string;

  @Field(() => Int)
  sessionCount: number;

  @Field(() => Float)
  avgEngagementScore: number;

  @Field(() => Float)
  weightedPositiveChoiceRatio: number;

  /** Sessions with status COMPLETED / sessionCount */
  @Field(() => Float)
  completionRate: number;

  @Field(() => Float, { nullable: true })
  previousAvgEngagementScore: number | null;

  @Field(() => Float, { nullable: true })
  engagementScoreDeltaPercent: number | null;
}

@ObjectType()
export class TherapistDashboardAnalyticsPayload {
  @Field(() => DashboardPeriod)
  period: DashboardPeriod;

  @Field(() => AnalyticsPeriodWindow)
  currentWindow: AnalyticsPeriodWindow;

  @Field(() => AnalyticsPeriodWindow, { nullable: true })
  previousWindow: AnalyticsPeriodWindow | null;

  @Field(() => DashboardComparison)
  summary: DashboardComparison;

  @Field(() => [ChildDashboardRow])
  byChild: ChildDashboardRow[];

  @Field(() => [TemplateDashboardRow])
  byTemplate: TemplateDashboardRow[];
}

@ObjectType()
export class GuardianChildTrendPoint {
  @Field(() => Date)
  bucketStart: Date;

  @Field(() => Date)
  bucketEnd: Date;

  @Field(() => Float)
  engagementScore: number;
}

@ObjectType()
export class GuardianChildSnapshot {
  @Field(() => ID)
  childProfileId: string;

  @Field(() => String, { nullable: true })
  displayName: string | null;

  @Field(() => Int)
  sessionCount: number;

  @Field(() => Float)
  completionRate: number;

  @Field(() => Float)
  positiveChoiceRatio: number;

  @Field(() => Float, { nullable: true })
  engagementDeltaPercent: number | null;

  @Field(() => String)
  statusLabel: string;

  @Field(() => String)
  parentSummary: string;

  @Field(() => [GuardianChildTrendPoint])
  trend: GuardianChildTrendPoint[];
}

@ObjectType()
export class GuardianChildAnalyticsPayload {
  @Field(() => DashboardPeriod)
  period: DashboardPeriod;

  @Field(() => AnalyticsPeriodWindow)
  currentWindow: AnalyticsPeriodWindow;

  @Field(() => AnalyticsPeriodWindow, { nullable: true })
  previousWindow: AnalyticsPeriodWindow | null;

  @Field(() => [GuardianChildSnapshot])
  children: GuardianChildSnapshot[];
}
