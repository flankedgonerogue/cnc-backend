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
export class TemplateOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const templateId = request.params?.id as string | undefined;

    if (!user?.id || !templateId) {
      throw new ForbiddenException('Access denied.');
    }

    const template = await this.prisma.storyTemplate.findFirst({
      where: {
        id: templateId,
        deletedAt: null,
        therapist: {
          userId: user.id,
        },
      } as unknown as NonNullable<
        Parameters<PrismaService['storyTemplate']['findFirst']>[0]
      >['where'],
      select: { id: true },
    });

    if (!template) {
      throw new ForbiddenException('You do not own this template.');
    }

    return true;
  }
}
