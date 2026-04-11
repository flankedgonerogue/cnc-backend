import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateResetTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
