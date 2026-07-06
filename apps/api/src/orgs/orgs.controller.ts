import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrgsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, org: { deletedAt: null } },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.org.id,
      slug: m.org.slug,
      name: m.org.name,
      plan: m.org.plan,
      role: m.role,
    }));
  }
}
