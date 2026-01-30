import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { StoryTone } from './enums/story-tone.enum';
import { PrismaService } from '../prisma/prisma.service';

describe('TemplatesService', () => {
  const prismaMock = {
    therapistProfile: {
      findUnique: jest.fn(),
    },
    storyTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prisma = prismaMock;
  const service = new TemplatesService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a template for therapist profile', async () => {
      prisma.therapistProfile.findUnique.mockResolvedValue({ id: 'tp-1' });
      prisma.storyTemplate.create.mockResolvedValue({
        id: 'st-1',
        therapistId: 'tp-1',
        targetBehavior: 'Turn-taking',
        setting: 'Playground',
        mainCharacter: 'Two kids sharing a ball',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: 'Keep it short',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.create('user-1', {
        targetBehavior: 'Turn-taking',
        setting: 'Playground',
        mainCharacter: 'Two kids sharing a ball',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: 'Keep it short',
      });

      expect(prisma.therapistProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { id: true },
      });
      expect(prisma.storyTemplate.create).toHaveBeenCalled();
      expect(result.id).toBe('st-1');
    });

    it('sanitizes seed data before create', async () => {
      prisma.therapistProfile.findUnique.mockResolvedValue({ id: 'tp-1' });
      prisma.storyTemplate.create.mockResolvedValue({
        id: 'st-2',
        therapistId: 'tp-1',
        targetBehavior: 'safe',
        setting: 'safe',
        mainCharacter: 'safe',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: 'safe',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await service.create('user-1', {
        targetBehavior: 'safe<script>alert(1)</script>',
        setting: 'safe\u0000',
        mainCharacter: ' safe ',
        emotionalTone: StoryTone.CALM,
        promptSuggestion: '\t safe ',
      });

      const createCalls = prisma.storyTemplate.create.mock.calls as Array<
        [
          {
            data: {
              targetBehavior?: string;
              setting?: string;
              mainCharacter?: string;
              promptSuggestion?: string;
            };
          },
        ]
      >;
      const createCall = createCalls[0]?.[0];
      if (!createCall) {
        throw new Error('Expected create call to be present');
      }
      expect(createCall.data.targetBehavior).toBe('safe');
      expect(createCall.data.setting).toBe('safe');
      expect(createCall.data.mainCharacter).toBe('safe');
      expect(createCall.data.promptSuggestion).toBe('safe');
    });

    it('throws when therapist profile missing', async () => {
      prisma.therapistProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          targetBehavior: 'Turn-taking',
          setting: 'Playground',
          mainCharacter: 'Two kids sharing a ball',
          emotionalTone: StoryTone.CALM,
          promptSuggestion: 'Keep it short',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns templates for therapist', async () => {
      prisma.storyTemplate.findMany.mockResolvedValue([
        { id: 'st-1' },
        { id: 'st-2' },
      ]);

      const result = await service.findAll('user-1', { take: 10, skip: 0 });

      expect(prisma.storyTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            therapist: { userId: 'user-1' },
          },
          take: 10,
          skip: 0,
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('returns a single template', async () => {
      prisma.storyTemplate.findFirst.mockResolvedValue({ id: 'st-1' });

      const result = await service.findOne('user-1', 'st-1');

      expect(prisma.storyTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'st-1',
            deletedAt: null,
            therapist: { userId: 'user-1' },
          },
        }),
      );
      expect(result.id).toBe('st-1');
    });

    it('throws when template not found', async () => {
      prisma.storyTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates template and returns updated record', async () => {
      prisma.storyTemplate.updateMany.mockResolvedValue({ count: 1 });
      prisma.storyTemplate.findFirst.mockResolvedValue({ id: 'st-1' });

      const result = await service.update('user-1', 'st-1', {
        targetBehavior: 'Updated',
      });

      expect(prisma.storyTemplate.updateMany).toHaveBeenCalled();
      expect(result.id).toBe('st-1');
    });

    it('throws when update affects no rows', async () => {
      prisma.storyTemplate.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update('user-1', 'st-1', { targetBehavior: 'Updated' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft deletes template', async () => {
      prisma.storyTemplate.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.remove('user-1', 'st-1')).resolves.toBeUndefined();

      const updateCalls = prisma.storyTemplate.updateMany.mock.calls as Array<
        [
          {
            where: {
              id: string;
              deletedAt: null;
              therapist: { userId: string };
            };
            data: { deletedAt: Date };
          },
        ]
      >;
      const updateCall = updateCalls[0]?.[0];
      if (!updateCall) {
        throw new Error('Expected updateMany call to be present');
      }
      expect(updateCall.where).toEqual({
        id: 'st-1',
        deletedAt: null,
        therapist: { userId: 'user-1' },
      });
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });

    it('throws when template not found', async () => {
      prisma.storyTemplate.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('user-1', 'st-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
