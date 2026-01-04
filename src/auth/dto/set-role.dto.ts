import { IsIn, IsNotEmpty } from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class SetRoleDto {
  @IsIn([Role.GUARDIAN, Role.CHILD], {
    message: 'Role must be GUARDIAN or CHILD',
  })
  @IsNotEmpty()
  role: Role;
}
