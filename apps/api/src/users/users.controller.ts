import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import type { MeResponse } from '@smtp/shared';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { memberships: { include: { org: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      emailVerified: !!u.emailVerifiedAt,
      memberships: u.memberships.map((m) => ({
        orgId: m.orgId,
        orgSlug: m.org.slug,
        orgName: m.org.name,
        role: m.role,
      })),
    };
  }
}
