import {
  Resolver,
  Mutation,
  Query,
  Args,
  Context,
  ID,
  Int,
} from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { AdminService } from './admin.service';
import { CreateTherapistDto } from './dto/create-therapist.dto';
import {
  TherapistEntity,
  UserEntity,
  UserConnectionEntity,
  SessionEntity,
  SessionDetailsEntity,
  AppStatsEntity,
  DeleteTherapistResponse,
  ReprovisionTherapistResponse,
} from './entities/therapist.entity';

@Resolver()
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Mutation(() => TherapistEntity, { name: 'createTherapist' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createTherapist(
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
    @Args('clinicName') clinicName: string,
    @Args('licenseNumber') licenseNumber: string,
    @Args('specialization', { nullable: true }) specialization?: string,
    @Args('bio', { nullable: true }) bio?: string,
    @Args('interventionThreshold', { type: () => Int, nullable: true })
    interventionThreshold?: number,
    @Context() context?: any,
  ): Promise<TherapistEntity> {
    const adminId = context?.req?.user?.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found in context');
    }

    const dto: CreateTherapistDto = {
      email,
      password,
      firstName,
      lastName,
      clinicName,
      licenseNumber,
      specialization,
      bio,
      interventionThreshold,
    };

    return this.adminService.createTherapist(adminId, dto);
  }

  @Query(() => [TherapistEntity], { name: 'listTherapists' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listTherapists(): Promise<TherapistEntity[]> {
    return this.adminService.listTherapists();
  }

  @Mutation(() => DeleteTherapistResponse, { name: 'deprovisionTherapist' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deprovisionTherapist(
    @Args('therapistUserId', { type: () => ID }) therapistUserId: string,
    @Context() context?: any,
  ): Promise<DeleteTherapistResponse> {
    const adminId = context?.req?.user?.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found in context');
    }

    return this.adminService.deprovisionTherapist(adminId, therapistUserId);
  }

  @Mutation(() => ReprovisionTherapistResponse, {
    name: 'reprovisionTherapist',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reprovisionTherapist(
    @Args('therapistUserId', { type: () => ID }) therapistUserId: string,
    @Context() context?: any,
  ): Promise<ReprovisionTherapistResponse> {
    const adminId = context?.req?.user?.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found in context');
    }

    return this.adminService.reprovisionTherapist(adminId, therapistUserId);
  }

  @Query(() => [UserEntity], { name: 'listAllUsers' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listAllUsers(): Promise<UserEntity[]> {
    return this.adminService.getAllUsers();
  }

  @Query(() => [UserConnectionEntity], { name: 'getUserConnections' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserConnections(): Promise<UserConnectionEntity[]> {
    return this.adminService.getUserConnections();
  }

  @Query(() => [SessionEntity], { name: 'listAllSessions' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async listAllSessions(): Promise<SessionEntity[]> {
    return this.adminService.getAllSessions();
  }

  @Query(() => SessionDetailsEntity, { name: 'getSessionDetails' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getSessionDetails(
    @Args('sessionId', { type: () => ID }) sessionId: string,
  ): Promise<SessionDetailsEntity> {
    return this.adminService.getSessionDetails(sessionId);
  }

  @Query(() => AppStatsEntity, { name: 'getAppStats' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAppStats(): Promise<AppStatsEntity> {
    return this.adminService.getAppStats();
  }
}
