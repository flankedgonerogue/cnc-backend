import { InputType, Field } from '@nestjs/graphql';
import { IsIn, IsNotEmpty } from 'class-validator';
import { Role } from '../../generated/prisma/client';

@InputType()
export class SetRoleDto {
  @Field(() => String)
  @IsIn([Role.GUARDIAN, Role.CHILD], {
    message: 'Role must be GUARDIAN or CHILD',
  })
  @IsNotEmpty()
  role: Role;
}
