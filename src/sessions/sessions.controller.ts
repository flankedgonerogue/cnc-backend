import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/decorators/user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SessionAccessGuard } from './guards/session-access.guard';
import { SessionsService } from './sessions.service';
import { AssignSessionDto } from './dto/assign-session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // ── Session assignment ─────────────────────────────────────────

  @Post()
  @Roles(Role.THERAPIST)
  @HttpCode(HttpStatus.CREATED)
  async assignSession(
    @User('id') userId: string,
    @Body() dto: AssignSessionDto,
  ) {
    return this.sessionsService.assignSession(userId, dto);
  }

  // ── Session listing ────────────────────────────────────────────

  @Get()
  @Roles(Role.THERAPIST)
  async listSessions(
    @User('id') userId: string,
    @Query('childProfileId') childProfileId?: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.sessionsService.listSessionsForTherapist(userId, {
      childProfileId,
      status,
      take: this.parsePositiveInt(take, 20),
      skip: this.parsePositiveInt(skip, 0),
    });
  }

  @Get('mine')
  @Roles(Role.CHILD)
  async mySessions(
    @User('id') userId: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.sessionsService.listSessionsForChild(userId, {
      status,
      take: this.parsePositiveInt(take, 20),
      skip: this.parsePositiveInt(skip, 0),
    });
  }

  // ── Session detail ─────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.THERAPIST, Role.CHILD)
  @UseGuards(SessionAccessGuard)
  async getSession(@Param('id') id: string) {
    return this.sessionsService.getSessionDetail(id);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
  ): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.min(parsed, 100)
      : fallback;
  }
}
