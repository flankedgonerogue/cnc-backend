import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { StoryTone } from '../enums/story-tone.enum';

export class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  targetBehavior: string;

  @IsString()
  @MaxLength(200)
  setting: string;

  @IsString()
  @MaxLength(500)
  characterDetails: string;

  @IsEnum(StoryTone)
  emotionalTone: StoryTone;

  @IsString()
  @MaxLength(500)
  promptSuggestion: string;
}
