import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsIn, IsNotEmpty, ValidateIf } from 'class-validator';
import { Role } from '../../generated/prisma/client';

@InputType()
export class SetRoleDto {
  @Field(() => String)
  @IsIn([Role.GUARDIAN, Role.CHILD], {
    message: 'Role must be GUARDIAN or CHILD',
  })
  @IsNotEmpty()
  role: Role;

  @Field(() => String, { nullable: true })
  @ValidateIf((o: SetRoleDto) => o.role === Role.CHILD)
  @IsNotEmpty({ message: 'therapistEmail is required when role is CHILD' })
  @IsEmail({}, { message: 'therapistEmail must be a valid email address' })
  therapistEmail?: string;
}
