import { Field, ID, Int, ObjectType, Float } from '@nestjs/graphql';

@ObjectType()
export class StoryChoice {
  @Field(() => ID)
  id: string;

  @Field()
  text: string;

  @Field(() => String, { nullable: true })
  behavioralTag?: string | null;
}

@ObjectType()
export class StoryChoiceDetail {
  @Field()
  text: string;

  @Field(() => String, { nullable: true })
  behavioralTag?: string | null;
}

@ObjectType()
export class StoryNodeEntity {
  @Field(() => ID)
  id: string;

  @Field()
  textContent: string;

  @Field(() => String, { nullable: true })
  imageUrl?: string | null;

  @Field(() => String, { nullable: true })
  audioUrl?: string | null;

  @Field(() => Float)
  confidenceScore: number;

  @Field(() => Boolean, { nullable: true })
  isApproved?: boolean;

  @Field(() => [StoryChoice], { nullable: true })
  choices?: StoryChoice[];
}

@ObjectType()
export class StoryNodeDetail {
  @Field()
  textContent: string;

  @Field(() => Float)
  confidenceScore: number;
}

@ObjectType()
export class StoryNodeResponse {
  @Field(() => ID)
  sessionId: string;

  @Field(() => StoryNodeEntity)
  node: StoryNodeEntity;
}

@ObjectType()
export class ContinueStoryResponse {
  @Field(() => ID)
  sessionId: string;

  @Field()
  isEnding: boolean;

  @Field(() => StoryNodeEntity)
  node: StoryNodeEntity;
}

@ObjectType()
export class StoryInteractionDetail {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  choiceSequenceNum: number;

  @Field(() => String, { nullable: true })
  behavioralPattern?: string | null;

  @Field(() => Int)
  timeTakenMs: number;

  @Field(() => Float, { nullable: true })
  nodeConfidenceScore?: number | null;

  @Field(() => Int)
  turnNumber: number;

  @Field(() => Int, { nullable: true })
  sessionDuration?: number | null;

  @Field(() => StoryChoiceDetail, { nullable: true })
  choice?: StoryChoiceDetail | null;

  @Field(() => StoryNodeDetail, { nullable: true })
  node?: StoryNodeDetail | null;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class StoryAnalyticsSummary {
  @Field(() => ID)
  sessionId: string;

  @Field(() => Int)
  totalInteractions: number;

  @Field(() => Int, { nullable: true })
  sessionDuration?: number | null;

  @Field(() => Float)
  overallEngagement: number;

  @Field(() => String, { nullable: true })
  therapistNotesForReview?: string | null;

  @Field()
  flaggedForTherapistReview: boolean;
}

@ObjectType()
export class BehavioralAnalyticsEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  sessionId: string;

  @Field(() => Int)
  totalChoices: number;

  @Field(() => Int)
  positiveChoices: number;

  @Field(() => Int)
  negativeChoices: number;

  @Field(() => Int)
  neutralChoices: number;

  @Field(() => Float)
  avgTimeTakenMs: number;

  @Field(() => Int, { nullable: true })
  minTimeTakenMs?: number | null;

  @Field(() => Int, { nullable: true })
  maxTimeTakenMs?: number | null;

  @Field(() => String, { nullable: true })
  decisionSpeedTrend?: string | null;

  @Field(() => String, { nullable: true })
  positiveChoicePattern?: string | null;

  @Field(() => Float)
  engagementScore: number;

  @Field(() => Float)
  avgNodeConfidenceScore: number;

  @Field(() => Int)
  therapistApprovedNodes: number;

  @Field(() => String, { nullable: true })
  dominantBehaviorPattern?: string | null;

  @Field()
  flaggedForReview: boolean;

  @Field(() => String, { nullable: true })
  notesForTherapist?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class SessionBehavioralAnalyticsResponse {
  @Field(() => BehavioralAnalyticsEntity)
  analytics: BehavioralAnalyticsEntity;

  @Field(() => [StoryInteractionDetail])
  interactions: StoryInteractionDetail[];

  @Field(() => StoryAnalyticsSummary)
  summary: StoryAnalyticsSummary;
}
