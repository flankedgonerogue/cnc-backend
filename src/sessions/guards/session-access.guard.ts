import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class SessionAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const sessionId = request.params?.id as string | undefined;

    if (!user?.id || !sessionId) {
      throw new ForbiddenException('Access denied.');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        child: {
          select: {
            userId: true,
            therapist: { select: { userId: true } },
          },
        },
      },
    });

    if (!session) {
      throw new ForbiddenException('Session not found.');
    }

    // Child accessing their own session
    if (user.role === 'CHILD' && session.child.userId === user.id) {
      return true;
    }

    // Therapist accessing their child's session
    if (user.role === 'THERAPIST' && session.child.therapist.userId === user.id) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this session.');
  }
}
