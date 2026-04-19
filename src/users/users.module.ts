import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { UsersController } from './users.controller';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule, ConfigModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService, UsersResolver, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
