import { IsString, MinLength } from 'class-validator';

export class StartStoryDto {
  @IsString()
  @MinLength(1)
  sessionId: string;
}
