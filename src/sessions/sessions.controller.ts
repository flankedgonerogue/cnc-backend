import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { SessionsService } from './sessions.service';
import { InitializeSessionDto } from './dto/initialize-session.dto';
import { MakeChoiceDto } from './dto/make-choice.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Initialize a new story session (Node 0)
   * Available to GUARDIAN and CHILD roles
   */
  @Post('initialize')
  @Roles(Role.GUARDIAN, Role.CHILD)
  @HttpCode(HttpStatus.CREATED)
  async initializeSession(@Body() dto: InitializeSessionDto) {
    return this.sessionsService.initializeSession(dto);
  }

  /**
   * Make a choice and continue the story (Node 1+)
   * Available to GUARDIAN and CHILD roles
   */
  @Post('choice')
  @Roles(Role.GUARDIAN, Role.CHILD)
  @HttpCode(HttpStatus.OK)
  async makeChoice(@Body() dto: MakeChoiceDto) {
    return this.sessionsService.makeChoice(dto.sessionId, dto.choiceText);
  }

  /**
   * Get session details
   * Available to all authenticated users
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSession(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }
}
