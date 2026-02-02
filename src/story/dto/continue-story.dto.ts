import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class ContinueStoryDto {
  @IsString()
  @MinLength(1)
  sessionId: string;

  @IsString()
  @MinLength(1)
  choiceId: string;

  @IsInt()
  @Min(0)
  timeTakenMs: number;
}
