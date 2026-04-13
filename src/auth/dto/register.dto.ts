import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

@InputType()
export class RegisterDto {
  @Field()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @Field(() => String)
  @IsIn([Role.GUARDIAN, Role.CHILD], {
    message: 'Role must be GUARDIAN or CHILD',
  })
  role: Role;

  @Field({ nullable: true })
  @IsString()
  firstName?: string;

  @Field({ nullable: true })
  @IsString()
  lastName?: string;

  @Field({ nullable: true })
  @ValidateIf((obj) => obj.role === Role.CHILD)
  @IsEmail()
  @IsNotEmpty({ message: 'therapistEmail is required for CHILD role' })
  therapistEmail?: string;
}
