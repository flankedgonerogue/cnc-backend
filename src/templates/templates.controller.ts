import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../common/decorators/user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateOwnershipGuard } from './guards/template-ownership.guard';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.THERAPIST)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@User('id') userId: string, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(userId, dto);
  }

  @Get()
  async findAll(
    @User('id') userId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedTake = take ? Number.parseInt(take, 10) : undefined;
    const parsedSkip = skip ? Number.parseInt(skip, 10) : undefined;

    const safeTake =
      parsedTake !== undefined && Number.isFinite(parsedTake)
        ? Math.min(Math.max(parsedTake, 1), 100)
        : undefined;
    const safeSkip =
      parsedSkip !== undefined && Number.isFinite(parsedSkip)
        ? Math.max(parsedSkip, 0)
        : undefined;

    return this.templatesService.findAll(userId, {
      take: safeTake,
      skip: safeSkip,
    });
  }

  @Get(':id')
  @UseGuards(TemplateOwnershipGuard)
  async findOne(@Param('id') id: string, @User('id') userId: string) {
    return this.templatesService.findOne(userId, id);
  }

  @Patch(':id')
  @UseGuards(TemplateOwnershipGuard)
  async update(
    @Param('id') id: string,
    @User('id') userId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(TemplateOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @User('id') userId: string) {
    await this.templatesService.remove(userId, id);
  }
}
