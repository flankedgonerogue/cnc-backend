import { IsString, IsInt, Min, Max, MaxLength, MinLength } from 'class-validator';

export class InitializeSessionDto {
  @IsString()
  childId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  childName: string;

  @IsInt()
  @Min(5)
  @Max(17)
  childAge: number;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  targetBehavior: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  characterName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  setting: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  emotionalTone: string;
}
