import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateDomainSchema, type CreateDomainInput } from '@smtp/shared';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { DomainsService } from './domains.service';

@Controller('orgs/:orgId/domains')
@UseGuards(AuthGuard, OrgAccessGuard)
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.domains.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(CreateDomainSchema)) input: CreateDomainInput,
  ) {
    return this.domains.create(org.orgId, input);
  }

  @Get(':id')
  get(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.domains.get(org.orgId, id);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.domains.verify(org.orgId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.domains.remove(org.orgId, id);
  }
}
