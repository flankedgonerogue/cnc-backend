import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryGenerationService } from '../story-generation/story-generation.service';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { PromptsService } from '../prompts/prompts.service';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    StoryGenerationService,
    ImageGenerationService,
    PromptsService,
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
