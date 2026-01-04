import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @IsIn([Role.GUARDIAN, Role.CHILD], {
    message: 'Role must be GUARDIAN or CHILD',
  })
  role: Role;

  @IsString()
  firstName?: string;

  @IsString()
  lastName?: string;
}
