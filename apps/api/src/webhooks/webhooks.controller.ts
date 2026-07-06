import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CreateWebhookSchema,
  UpdateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
} from '@smtp/shared';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { WebhooksService } from './webhooks.service';

@Controller('orgs/:orgId/webhooks')
@UseGuards(AuthGuard, OrgAccessGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.webhooks.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(CreateWebhookSchema)) input: CreateWebhookInput,
  ) {
    return this.webhooks.create(org.orgId, input);
  }

  @Patch(':id')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWebhookSchema)) input: UpdateWebhookInput,
  ) {
    return this.webhooks.update(org.orgId, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.webhooks.remove(org.orgId, id);
  }
}
