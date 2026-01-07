import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as storageModule from '../storage/storage.module';

type BaseProfile = {
  id: string;
  email: string;
  role?: Role | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
  locale?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UnifiedProfile = {
  user: BaseProfile;
  therapistProfile?: {
    userId: string;
    specialization?: string | null;
    licenseNumber?: string | null;
    bio?: string | null;
    clinicName?: string | null;
    interventionThreshold?: number | null;
  } | null;
  guardianProfile?: {
    userId: string;
    relationship?: string | null;
    phoneNumber?: string | null;
    emergencyContactInfo?: string | null;
    notificationPreferences?: Prisma.JsonValue | null;
  } | null;
  childProfile?: {
    userId: string;
    therapistId: string;
    guardianId?: string | null;
    dateOfBirth?: Date | null;
    interests?: string[] | null;
    triggers?: string[] | null;
    behavioralGoals?: Prisma.JsonValue | null;
    gamificationData?: Prisma.JsonValue | null;
    progressStats?: Prisma.JsonValue | null;
  } | null;
};

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(storageModule.STORAGE_SERVICE)
    private readonly storageService: storageModule.StorageService,
  ) {}

  async getProfile(userId: string): Promise<UnifiedProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        therapistProfile: {
          select: {
            userId: true,
            specialization: true,
            licenseNumber: true,
            bio: true,
            clinicName: true,
            interventionThreshold: true,
          },
        },
        guardianProfile: {
          select: {
            userId: true,
            relationship: true,
            phoneNumber: true,
            emergencyContactInfo: true,
            notificationPreferences: true,
          },
        },
        childProfile: {
          select: {
            userId: true,
            therapistId: true,
            guardianId: true,
            dateOfBirth: true,
            interests: true,
            triggers: true,
            behavioralGoals: true,
            gamificationData: true,
            progressStats: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const resolvedAvatar =
      user.avatarUrl ?? this.getAvatarPlaceholderUrl() ?? null;

    const base: BaseProfile = {
      ...user,
      avatarUrl: resolvedAvatar,
    };

    return {
      user: base,
      therapistProfile: user.therapistProfile ?? null,
      guardianProfile: user.guardianProfile ?? null,
      childProfile: user.childProfile ?? null,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UnifiedProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        therapistProfile: { select: { userId: true } },
        guardianProfile: { select: { userId: true } },
        childProfile: { select: { userId: true, therapistId: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (dto.behavioralGoals !== undefined && user.role !== Role.THERAPIST) {
      throw new ForbiddenException(
        'Only the assigned therapist can update behavioral goals.',
      );
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) {
      userData.email = dto.email;
    }
    if (dto.firstName !== undefined) {
      userData.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      userData.lastName = dto.lastName;
    }
    if (dto.displayName !== undefined) {
      userData.displayName = dto.displayName;
    }
    if (dto.timezone !== undefined) {
      userData.timezone = dto.timezone;
    }
    if (dto.locale !== undefined) {
      userData.locale = dto.locale;
    }

    const operations: Array<Prisma.PrismaPromise<unknown>> = [];

    if (Object.keys(userData).length > 0) {
      operations.push(
        this.prisma.user.update({
          where: { id: userId },
          data: userData,
        }),
      );
    }

    if (user.role === Role.THERAPIST) {
      if (!user.therapistProfile) {
        throw new NotFoundException('Therapist profile not found.');
      }

      const therapistData: Prisma.TherapistProfileUpdateInput = {};
      if (dto.specialization !== undefined) {
        therapistData.specialization = dto.specialization;
      }
      if (dto.licenseNumber !== undefined) {
        therapistData.licenseNumber = dto.licenseNumber;
      }
      if (dto.bio !== undefined) {
        therapistData.bio = dto.bio;
      }
      if (dto.clinicName !== undefined) {
        therapistData.clinicName = dto.clinicName;
      }
      if (dto.interventionThreshold !== undefined) {
        therapistData.interventionThreshold = dto.interventionThreshold;
      }

      if (Object.keys(therapistData).length > 0) {
        operations.push(
          this.prisma.therapistProfile.update({
            where: { userId },
            data: therapistData,
          }),
        );
      }
    }

    if (user.role === Role.GUARDIAN) {
      if (!user.guardianProfile) {
        throw new NotFoundException('Guardian profile not found.');
      }

      const guardianData: Prisma.GuardianProfileUpdateInput = {};
      if (dto.relationship !== undefined) {
        guardianData.relationship = dto.relationship;
      }
      if (dto.phoneNumber !== undefined) {
        guardianData.phoneNumber = dto.phoneNumber;
      }
      if (dto.emergencyContactInfo !== undefined) {
        guardianData.emergencyContactInfo = dto.emergencyContactInfo;
      }
      if (dto.notificationPreferences !== undefined) {
        guardianData.notificationPreferences = dto.notificationPreferences;
      }

      if (Object.keys(guardianData).length > 0) {
        operations.push(
          this.prisma.guardianProfile.update({
            where: { userId },
            data: guardianData,
          }),
        );
      }
    }

    if (user.role === Role.CHILD) {
      if (!user.childProfile) {
        throw new NotFoundException('Child profile not found.');
      }

      if (dto.behavioralGoals !== undefined) {
        throw new ForbiddenException(
          'Only the assigned therapist can update behavioral goals.',
        );
      }

      const childData: Prisma.ChildProfileUpdateInput = {};
      if (dto.dateOfBirth !== undefined) {
        childData.dateOfBirth = new Date(dto.dateOfBirth);
      }
      if (dto.interests !== undefined) {
        childData.interests = { set: dto.interests };
      }
      if (dto.triggers !== undefined) {
        childData.triggers = { set: dto.triggers };
      }
      if (dto.gamificationData !== undefined) {
        childData.gamificationData = dto.gamificationData;
      }

      if (Object.keys(childData).length > 0) {
        operations.push(
          this.prisma.childProfile.update({
            where: { userId },
            data: childData,
          }),
        );
      }
    }

    if (operations.length === 0) {
      throw new BadRequestException('No valid fields provided for update.');
    }

    await this.prisma.$transaction(operations);

    return this.getProfile(userId);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const previousAvatar = user.avatarUrl ?? null;
    const newAvatarUrl = await this.storageService.uploadFile(file);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
    });

    const placeholder = this.getAvatarPlaceholderUrl();
    if (previousAvatar && previousAvatar !== placeholder) {
      await this.storageService.deleteFile(previousAvatar);
    }

    return { avatarUrl: newAvatarUrl };
  }

  async deleteAvatar(userId: string): Promise<{ avatarUrl: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const previousAvatar = user.avatarUrl ?? null;
    const placeholder = this.getAvatarPlaceholderUrl();

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: placeholder ?? null },
    });

    if (previousAvatar && previousAvatar !== placeholder) {
      await this.storageService.deleteFile(previousAvatar);
    }

    return { avatarUrl: placeholder ?? null };
  }

  private getAvatarPlaceholderUrl(): string | null {
    return this.configService.get<string>('AVATAR_PLACEHOLDER_URL') ?? null;
  }
}
