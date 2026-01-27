import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTherapistDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clinicName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: 'License number must be alphanumeric with optional dashes.',
  })
  licenseNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Intervention threshold must be a valid number.' },
  )
  @Min(0)
  @Max(1)
  interventionThreshold?: number;
}
