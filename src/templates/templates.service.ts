import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoryTemplate } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

type PaginationParams = {
  skip?: number;
  take?: number;
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    therapistUserId: string,
    dto: CreateTemplateDto,
  ): Promise<StoryTemplate> {
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId: therapistUserId },
      select: { id: true },
    });

    if (!therapistProfile) {
      throw new NotFoundException('Therapist profile not found.');
    }

    const sanitized = this.validateSeedDataForAI(dto);

    return this.prisma.storyTemplate.create({
      data: {
        therapistId: therapistProfile.id,
        targetBehavior: sanitized.targetBehavior,
        setting: sanitized.setting,
        mainCharacter: sanitized.mainCharacter,
        emotionalTone: sanitized.emotionalTone,
        promptSuggestion: sanitized.promptSuggestion,
      },
    });
  }

  async findAll(
    therapistUserId: string,
    pagination: PaginationParams = {},
  ): Promise<StoryTemplate[]> {
    const { skip = 0, take = 20 } = pagination;

    const where = {
      deletedAt: null,
      therapist: {
        userId: therapistUserId,
      },
    } as unknown as Prisma.StoryTemplateWhereInput;
    const orderBy = {
      createdAt: 'desc',
    } as unknown as Prisma.StoryTemplateOrderByWithRelationInput;

    return this.prisma.storyTemplate.findMany({
      where,
      orderBy,
      skip,
      take,
    });
  }

  async findOne(
    therapistUserId: string,
    templateId: string,
  ): Promise<StoryTemplate> {
    const where = {
      id: templateId,
      deletedAt: null,
      therapist: {
        userId: therapistUserId,
      },
    } as unknown as Prisma.StoryTemplateWhereInput;

    const template = await this.prisma.storyTemplate.findFirst({
      where,
    });

    if (!template) {
      throw new NotFoundException('Template not found.');
    }

    return template;
  }

  async update(
    therapistUserId: string,
    templateId: string,
    dto: UpdateTemplateDto,
  ): Promise<StoryTemplate> {
    const sanitized = this.validateSeedDataForAI(
      dto as Partial<CreateTemplateDto>,
    );

    const where = {
      id: templateId,
      deletedAt: null,
      therapist: {
        userId: therapistUserId,
      },
    } as unknown as Prisma.StoryTemplateWhereInput;

    const data: Prisma.StoryTemplateUpdateManyMutationInput = {};
    if (sanitized.targetBehavior !== undefined) {
      data.targetBehavior = sanitized.targetBehavior;
    }
    if (sanitized.setting !== undefined) {
      data.setting = sanitized.setting;
    }
    if (sanitized.mainCharacter !== undefined) {
      data.mainCharacter = sanitized.mainCharacter;
    }
    if (sanitized.emotionalTone !== undefined) {
      data.emotionalTone = sanitized.emotionalTone;
    }
    if (sanitized.promptSuggestion !== undefined) {
      data.promptSuggestion = sanitized.promptSuggestion;
    }

    const updated = await this.prisma.storyTemplate.updateMany({
      where,
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Template not found.');
    }

    return this.findOne(therapistUserId, templateId);
  }

  async remove(therapistUserId: string, templateId: string): Promise<void> {
    const where = {
      id: templateId,
      deletedAt: null,
      therapist: {
        userId: therapistUserId,
      },
    } as unknown as Prisma.StoryTemplateWhereInput;

    const data = {
      deletedAt: new Date(),
    } as unknown as Prisma.StoryTemplateUpdateManyMutationInput;

    const updated = await this.prisma.storyTemplate.updateMany({
      where,
      data,
    });

    if (updated.count === 0) {
      throw new NotFoundException('Template not found.');
    }
  }

  private validateSeedDataForAI<T extends Partial<CreateTemplateDto>>(
    dto: T,
  ): T {
    return {
      ...dto,
      targetBehavior: this.sanitizeText(dto.targetBehavior),
      setting: this.sanitizeText(dto.setting),
      mainCharacter: this.sanitizeText(dto.mainCharacter),
      promptSuggestion: this.sanitizeText(dto.promptSuggestion),
    };
  }

  private sanitizeText(value: string | undefined): string | undefined {
    if (!value) {
      return value;
    }

    const withoutScripts = value.replace(
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      '',
    );

    return this.stripControlChars(withoutScripts).trim();
  }

  private stripControlChars(value: string): string {
    let result = '';
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code >= 32 && code !== 127) {
        result += value[i];
      }
    }
    return result;
  }
}
