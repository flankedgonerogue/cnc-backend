import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionAccessGuard } from './guards/session-access.guard';
import { SessionsResolver } from './sessions.resolver';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionAccessGuard, SessionsResolver],
  exports: [SessionsService],
})
export class SessionsModule {}
