import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionAccessGuard } from './guards/session-access.guard';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionAccessGuard],
  exports: [SessionsService],
})
export class SessionsModule {}
