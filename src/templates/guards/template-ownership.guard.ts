import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class TemplateOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let user: AuthenticatedUser | undefined;
    let templateId: string | undefined;

    if (context.getType().toString() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      user = gqlContext.getContext().req.user;
      templateId = gqlContext.getArgs().id;
    } else {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      user = request.user;
      templateId = request.params?.id as string | undefined;
    }

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
