import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class StartStoryDto {
  @IsString()
  @MinLength(1)
  sessionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  childName: string;

  @IsInt()
  @Min(3)
  @Max(18)
  childAge: number;
}
