import { IsString, MinLength } from 'class-validator';

export class AssignSessionDto {
  @IsString()
  @MinLength(1)
  childProfileId: string;

  @IsString()
  @MinLength(1)
  templateId: string;
}
