import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class TherapistProfileType {
  @Field()
  userId: string;

  @Field({ nullable: true })
  specialization?: string;

  @Field({ nullable: true })
  licenseNumber?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  clinicName?: string;

  @Field({ nullable: true })
  interventionThreshold?: number;
}

@ObjectType()
export class GuardianProfileType {
  @Field()
  userId: string;

  @Field({ nullable: true })
  relationship?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  emergencyContactInfo?: string;

  @Field({ nullable: true })
  notificationPreferences?: string;
}

@ObjectType()
export class ChildProfileType {
  @Field()
  userId: string;

  @Field()
  therapistId: string;

  @Field({ nullable: true })
  guardianId?: string;

  @Field({ nullable: true })
  dateOfBirth?: Date;

  @Field(() => [String], { nullable: true })
  interests?: string[];

  @Field(() => [String], { nullable: true })
  triggers?: string[];

  @Field({ nullable: true })
  behavioralGoals?: string;

  @Field({ nullable: true })
  gamificationData?: string;

  @Field({ nullable: true })
  progressStats?: string;
}

@ObjectType()
export class UserAuthWithProfile {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  role?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => TherapistProfileType, { nullable: true })
  therapistProfile?: TherapistProfileType;

  @Field(() => GuardianProfileType, { nullable: true })
  guardianProfile?: GuardianProfileType;

  @Field(() => ChildProfileType, { nullable: true })
  childProfile?: ChildProfileType;
}
