import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { GeminiService } from './gemini/gemini.service';
import { PromptService } from './prompt/prompt.service';

@Module({
  imports: [PrismaModule, StorageModule, ConfigModule],
  controllers: [StoryController],
  providers: [StoryService, GeminiService, PromptService],
  exports: [StoryService],
})
export class StoryModule {}
