import { Field, ID, ObjectType, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class TherapistEntity {
  @Field(() => ID)
  userId: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => String, { nullable: true })
  clinicName?: string | null;

  @Field(() => String, { nullable: true })
  licenseNumber?: string | null;

  @Field(() => String, { nullable: true })
  specialization?: string | null;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => Int, { nullable: true })
  interventionThreshold?: number | null;

  @Field()
  activeChildCount: number;
}

@ObjectType()
export class UserEntity {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  role?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class UserConnectionEntity {
  @Field(() => ID)
  childId: string;

  @Field()
  childEmail: string;

  @Field(() => String, { nullable: true })
  childName?: string | null;

  @Field(() => ID)
  therapistId: string;

  @Field()
  therapistEmail: string;

  @Field(() => String, { nullable: true })
  therapistName?: string | null;

  @Field(() => ID, { nullable: true })
  guardianId?: string | null;

  @Field(() => String, { nullable: true })
  guardianEmail?: string | null;
}

@ObjectType()
export class SessionEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  childId: string;

  @Field()
  childName: string;

  @Field(() => ID)
  templateId: string;

  @Field()
  templateName: string;

  @Field()
  status: string;

  @Field()
  startedAt: Date;

  @Field(() => Date, { nullable: true })
  endedAt?: Date | null;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class SessionDetailsEntity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  childId: string;

  @Field()
  childName: string;

  @Field(() => ID)
  templateId: string;

  @Field()
  templateName: string;

  @Field(() => ID)
  therapistId: string;

  @Field()
  therapistName: string;

  @Field()
  status: string;

  @Field(() => Float)
  averageConfidenceScore: number;

  @Field()
  totalInteractions: number;

  @Field()
  startedAt: Date;

  @Field(() => Date, { nullable: true })
  endedAt?: Date | null;
}

@ObjectType()
export class StorageUsageEntity {
  @Field()
  avatarCount: number;

  @Field()
  storyImageCount: number;

  @Field()
  storyAudioCount: number;
}

@ObjectType()
export class AppStatsEntity {
  @Field()
  totalUsers: number;

  @Field()
  adminCount: number;

  @Field()
  therapistCount: number;

  @Field()
  guardianCount: number;

  @Field()
  childCount: number;

  @Field()
  unassignedUserCount: number;

  @Field()
  totalSessions: number;

  @Field()
  activeSessions: number;

  @Field()
  completedSessions: number;

  @Field()
  pausedSessions: number;

  @Field(() => Float)
  averageSessionConfidenceScore: number;

  @Field()
  pausedForReviewCount: number;

  @Field(() => StorageUsageEntity)
  storageUsage: StorageUsageEntity;
}

@ObjectType()
export class DeleteTherapistResponse {
  @Field(() => ID)
  userId: string;

  @Field()
  deletedAt: Date;
}

@ObjectType()
export class ReprovisionTherapistResponse {
  @Field(() => ID)
  userId: string;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}
