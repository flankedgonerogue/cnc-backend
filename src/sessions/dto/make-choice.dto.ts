import { IsString, IsNotEmpty } from 'class-validator';

export class MakeChoiceDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  choiceText: string;
}
