import {
  Field,
  ID,
  Int,
  ObjectType,
  registerEnumType,
  Float,
} from '@nestjs/graphql';
import { SessionStatus } from '../generated/prisma/client';
import { Template } from '../templates/template.entity';

registerEnumType(SessionStatus, {
  name: 'SessionStatus',
  description: 'The status of the session',
});

@ObjectType()
export class SessionUser {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;
}

@ObjectType()
export class SessionChild {
  @Field(() => ID)
  id: string;

  @Field(() => SessionUser, { nullable: true })
  user?: SessionUser;
}

@ObjectType()
export class Choice {
  @Field(() => ID)
  id: string;

  @Field()
  text: string;

  @Field({ nullable: true })
  behavioralTag?: string;
}

@ObjectType()
export class StoryNode {
  @Field(() => ID)
  id: string;

  @Field()
  textContent: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  audioUrl?: string;

  @Field(() => Float)
  confidenceScore: number;

  @Field()
  isApproved: boolean;

  @Field(() => [Choice], { nullable: true })
  choices?: Choice[];
}

@ObjectType()
export class Interaction {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  timeTakenMs: number;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class SessionCount {
  @Field(() => Int)
  nodes: number;
}

@ObjectType()
export class Session {
  @Field(() => ID)
  id: string;

  @Field()
  childId: string;

  @Field()
  templateId: string;

  @Field(() => SessionStatus)
  status: SessionStatus;

  @Field()
  startedAt: Date;

  @Field({ nullable: true })
  endedAt?: Date;

  @Field(() => SessionChild, { nullable: true })
  child?: SessionChild;

  @Field(() => Template, { nullable: true })
  template?: Template;

  @Field(() => [StoryNode], { nullable: true })
  nodes?: StoryNode[];

  @Field(() => [Interaction], { nullable: true })
  interactions?: Interaction[];

  @Field(() => SessionCount, { nullable: true })
  _count?: SessionCount;
}
