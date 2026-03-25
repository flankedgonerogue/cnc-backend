import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { StoryTone } from '../enums/story-tone.enum';

@InputType()
export class CreateTemplateDto {
  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  targetBehavior: string;

  @Field()
  @IsString()
  @MaxLength(200)
  setting: string;

  @Field()
  @IsString()
  @MaxLength(500)
  mainCharacter: string;

  @Field(() => StoryTone)
  @IsEnum(StoryTone)
  emotionalTone: StoryTone;

  @Field()
  @IsString()
  @MaxLength(500)
  promptSuggestion: string;

  @Field({ nullable: true })
  @IsString()
  @MaxLength(500)
  visualStyle?: string;
}
