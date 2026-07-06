import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CreateSmtpCredentialSchema, type CreateSmtpCredentialInput } from '@smtp/shared';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { SmtpCredentialsService } from './smtp-credentials.service';

@Controller('orgs/:orgId/smtp-credentials')
@UseGuards(AuthGuard, OrgAccessGuard)
export class SmtpCredentialsController {
  constructor(private readonly creds: SmtpCredentialsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.creds.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(CreateSmtpCredentialSchema)) input: CreateSmtpCredentialInput,
  ) {
    return this.creds.create(org.orgId, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.creds.revoke(org.orgId, id);
  }
}
