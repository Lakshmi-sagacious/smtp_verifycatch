import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCredentialSchema,
  CreateInboxSchema,
  UpdateInboxSchema,
  type CreateCredentialInput,
  type CreateInboxInput,
  type UpdateInboxInput,
} from '@smtp/shared';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { InboxesService } from './inboxes.service';

@Controller('orgs/:orgId/inboxes')
@UseGuards(AuthGuard, OrgAccessGuard)
export class InboxesController {
  constructor(private readonly inboxes: InboxesService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.inboxes.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(CreateInboxSchema)) input: CreateInboxInput,
  ) {
    return this.inboxes.create(org.orgId, input);
  }

  @Get(':inboxId')
  get(@CurrentOrg() org: OrgContext, @Param('inboxId') inboxId: string) {
    return this.inboxes.get(org.orgId, inboxId);
  }

  @Patch(':inboxId')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('inboxId') inboxId: string,
    @Body(new ZodValidationPipe(UpdateInboxSchema)) input: UpdateInboxInput,
  ) {
    return this.inboxes.update(org.orgId, inboxId, input);
  }

  @Delete(':inboxId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOrg() org: OrgContext, @Param('inboxId') inboxId: string) {
    await this.inboxes.softDelete(org.orgId, inboxId);
  }

  @Get(':inboxId/credentials')
  listCredentials(@CurrentOrg() org: OrgContext, @Param('inboxId') inboxId: string) {
    return this.inboxes.listCredentials(org.orgId, inboxId);
  }

  @Post(':inboxId/credentials')
  createCredential(
    @CurrentOrg() org: OrgContext,
    @Param('inboxId') inboxId: string,
    @Body(new ZodValidationPipe(CreateCredentialSchema)) input: CreateCredentialInput,
  ) {
    return this.inboxes.createCredential(org.orgId, inboxId, input);
  }

  @Delete(':inboxId/credentials/:credId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeCredential(
    @CurrentOrg() org: OrgContext,
    @Param('inboxId') inboxId: string,
    @Param('credId') credId: string,
  ) {
    await this.inboxes.revokeCredential(org.orgId, inboxId, credId);
  }
}
