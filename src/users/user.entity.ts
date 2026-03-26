import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class TherapistProfile {
  @Field(() => ID)
  id: string;

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

  @Field(() => Float, { nullable: true })
  interventionThreshold?: number;
}

@ObjectType()
export class GuardianProfile {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  relationship?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  emergencyContactInfo?: string;
}

@ObjectType()
export class ChildProfile {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  therapistId: string;

  @Field({ nullable: true })
  guardianId?: string;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  // Not exposed via GraphQL
  passwordHash?: string;

  @Field(() => String, { nullable: true })
  role?: 'ADMIN' | 'THERAPIST' | 'GUARDIAN' | 'CHILD';

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  displayName?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  timezone?: string;

  @Field(() => String, { nullable: true })
  locale?: string;

  @Field(() => Date, { nullable: true })
  lastLoginAt?: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  @Field(() => TherapistProfile, { nullable: true })
  therapistProfile?: TherapistProfile;

  @Field(() => GuardianProfile, { nullable: true })
  guardianProfile?: GuardianProfile;

  @Field(() => ChildProfile, { nullable: true })
  childProfile?: ChildProfile;
}
