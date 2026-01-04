import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplateOwnershipGuard } from './guards/template-ownership.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateOwnershipGuard, RolesGuard],
  exports: [TemplatesService],
})
export class TemplatesModule {}
