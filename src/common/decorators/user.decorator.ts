import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user';

type UserSelect = keyof AuthenticatedUser | Array<keyof AuthenticatedUser>;
type RequestWithUser = Request & { user?: AuthenticatedUser };

export const User = createParamDecorator(
  (data: UserSelect | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!data) {
      return user;
    }

    if (Array.isArray(data)) {
      return data.reduce<
        Record<string, AuthenticatedUser[keyof AuthenticatedUser] | undefined>
      >((acc, key) => {
        acc[key] = user?.[key];
        return acc;
      }, {});
    }

    return user?.[data];
  },
);
