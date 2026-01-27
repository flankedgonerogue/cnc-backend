import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../common/decorators/user.decorator';
import { CreateTherapistDto } from './dto/create-therapist.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('therapists')
  @HttpCode(HttpStatus.CREATED)
  async createTherapist(
    @User('id') adminId: string,
    @Body() dto: CreateTherapistDto,
  ) {
    return this.adminService.createTherapist(adminId, dto);
  }

  @Get('therapists')
  async listTherapists() {
    return this.adminService.listTherapists();
  }

  @Delete('therapists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deprovisionTherapist(
    @User('id') adminId: string,
    @Param('id') therapistUserId: string,
  ) {
    await this.adminService.deprovisionTherapist(adminId, therapistUserId);
  }

  @Post('therapists/:id/reprovision')
  async reprovisionTherapist(
    @User('id') adminId: string,
    @Param('id') therapistUserId: string,
  ) {
    return this.adminService.reprovisionTherapist(adminId, therapistUserId);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }
}
