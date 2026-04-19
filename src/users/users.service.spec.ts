import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService guardian-child pairing', () => {
  const prisma = {
    guardianProfile: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn() },
    guardianChildPairingRequest: { create: jest.fn(), findUnique: jest.fn() },
    childProfile: { update: jest.fn() },
    $transaction: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        BACKEND_URL: 'http://localhost:3000',
        FRONTEND_SUCCESSFUL_PAIRING_URL: 'http://localhost:3001/pairing/success',
        FRONTEND_ERROR_URL: 'http://localhost:3001/pairing/error',
      };
      return values[key] ?? fallback;
    }),
  } as any;

  const emailService = {
    sendGuardianPairingEmail: jest.fn(),
  } as any;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma, configService, emailService);
  });

  it('creates a child for guardian using therapistEmail', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'gp-1' });
    prisma.user.findFirst
      .mockResolvedValueOnce({
        id: 'therapist-user-1',
        therapistProfile: { id: 'tp-1' },
      })
      .mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValue({
      id: 'child-user-1',
      email: 'child@example.com',
      role: 'CHILD',
      therapistProfile: null,
      guardianProfile: null,
      childProfile: { therapistId: 'tp-1', guardianId: 'gp-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createChildForGuardian('guardian-user-1', {
      email: 'child@example.com',
      password: 'secret123',
      therapistEmail: 'therapist@example.com',
      firstName: 'Child',
      lastName: 'One',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          childProfile: {
            create: { therapistId: 'tp-1', guardianId: 'gp-1' },
          },
        }),
      }),
    );
  });

  it('creates pairing request and sends pairing email', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'gp-1' });
    prisma.user.findFirst.mockResolvedValue({
      id: 'child-user-1',
      email: 'child@example.com',
      role: 'CHILD',
      childProfile: { guardianId: null },
    });
    prisma.guardianChildPairingRequest.create.mockResolvedValue({ id: 'req-1' });

    const result = await service.requestPairingForExistingChild(
      'guardian-user-1',
      'child@example.com',
    );

    expect(prisma.guardianChildPairingRequest.create).toHaveBeenCalled();
    expect(emailService.sendGuardianPairingEmail).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('rejects pairing request when child already linked to guardian', async () => {
    prisma.guardianProfile.findUnique.mockResolvedValue({ id: 'gp-1' });
    prisma.user.findFirst.mockResolvedValue({
      id: 'child-user-1',
      email: 'child@example.com',
      role: 'CHILD',
      childProfile: { guardianId: 'gp-1' },
    });

    await expect(
      service.requestPairingForExistingChild('guardian-user-1', 'child@example.com'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirms valid pairing token and links child profile', async () => {
    prisma.guardianChildPairingRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      childUserId: 'child-user-1',
      guardianProfileId: 'gp-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      childUser: { childProfile: { userId: 'child-user-1' } },
    });
    prisma.$transaction.mockResolvedValue(undefined);

    const result = await service.confirmPairingToken('token-123');

    expect(result.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
