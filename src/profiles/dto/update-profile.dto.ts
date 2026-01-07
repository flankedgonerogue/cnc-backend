import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  // TherapistProfile fields
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  clinicName?: string;

  @IsOptional()
  @IsNumber()
  interventionThreshold?: number;

  // GuardianProfile fields
  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  emergencyContactInfo?: string;

  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, boolean>;

  // ChildProfile fields
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsArray()
  interests?: string[];

  @IsOptional()
  @IsArray()
  triggers?: string[];

  @IsOptional()
  @ValidateIf((_, value) => Array.isArray(value))
  @IsArray()
  @ValidateIf(
    (_, value) =>
      value !== null && value !== undefined && !Array.isArray(value),
  )
  @IsObject()
  behavioralGoals?: Record<string, unknown> | unknown[];

  @IsOptional()
  @IsObject()
  gamificationData?: {
    currentPoints?: number;
    level?: number;
    unlockedAvatarItems?: string[];
  };
}
