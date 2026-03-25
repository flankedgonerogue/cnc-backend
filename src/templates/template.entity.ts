import { ObjectType, Field, ID } from '@nestjs/graphql';
import { StoryTone } from './enums/story-tone.enum';

@ObjectType()
export class Template {
  @Field(() => ID)
  id: string;

  @Field()
  therapistId: string;

  @Field()
  targetBehavior: string;

  @Field()
  setting: string;

  @Field()
  mainCharacter: string;

  @Field(() => StoryTone)
  emotionalTone: string;

  @Field()
  promptSuggestion: string;

  @Field()
  visualStyle: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}
