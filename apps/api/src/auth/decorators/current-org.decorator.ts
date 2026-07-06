import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { OrgContext } from '../guards/org-access.guard';

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => {
    const req = ctx.switchToHttp().getRequest<{ org?: OrgContext }>();
    if (!req.org) throw new Error('CurrentOrg used without OrgAccessGuard');
    return req.org;
  },
);
