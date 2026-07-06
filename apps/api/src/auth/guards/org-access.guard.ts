import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@smtp/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';

export interface OrgContext {
  orgId: string;
  role: Role;
}

// Reads :orgId from the URL and confirms the authenticated user belongs to it.
// Must run after AuthGuard — order guards as [AuthGuard, OrgAccessGuard].
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      Request & { user?: AuthUser; org?: OrgContext; params: Record<string, string> }
    >();
    const orgId = req.params.orgId;
    if (!orgId) throw new BadRequestException('Missing orgId path param');
    if (!req.user) throw new ForbiddenException('Unauthenticated');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.user.id, orgId } },
      include: { org: true },
    });
    if (!membership || membership.org.deletedAt) {
      throw new ForbiddenException('Not a member of this organization');
    }

    req.org = { orgId, role: membership.role };
    return true;
  }
}
