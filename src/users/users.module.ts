import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, UsersResolver, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
