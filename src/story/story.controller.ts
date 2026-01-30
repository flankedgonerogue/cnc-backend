import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/decorators/user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { StoryService } from './story.service';
import { StartStoryDto } from './dto/start-story.dto';
import { ContinueStoryDto } from './dto/continue-story.dto';

@Controller('story')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.THERAPIST, Role.CHILD)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async startStory(@User('id') userId: string, @Body() dto: StartStoryDto) {
    return this.storyService.startStory(userId, dto);
  }

  @Post('continue')
  @HttpCode(HttpStatus.OK)
  async continueStory(@User('id') userId: string, @Body() dto: ContinueStoryDto) {
    return this.storyService.continueStory(userId, dto);
  }
}
