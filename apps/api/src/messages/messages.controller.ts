import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { MessagesService } from './messages.service';

@Controller('orgs/:orgId')
@UseGuards(AuthGuard, OrgAccessGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('inboxes/:inboxId/messages')
  list(
    @CurrentOrg() org: OrgContext,
    @Param('inboxId') inboxId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.listForInbox(org.orgId, inboxId, cursor, Number(limit) || 0);
  }

  @Get('messages')
  listAll(
    @CurrentOrg() org: OrgContext,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('domainId') domainId?: string,
    @Query('inboxId') inboxId?: string,
    @Query('q') q?: string,
  ) {
    return this.messages.listForOrg(org.orgId, {
      cursor,
      limit: Number(limit) || undefined,
      kind: kind === 'SANDBOX_INBOUND' || kind === 'RELAY_OUTBOUND' ? kind : undefined,
      status,
      domainId,
      inboxId,
      q,
    });
  }

  @Get('messages/:id')
  get(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.messages.get(org.orgId, id);
  }

  @Get('messages/:id/raw')
  async raw(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.messages.getRawStream(org.orgId, id);
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Get('messages/:id/attachments/:attachmentId')
  async attachment(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { stream, filename, contentType } = await this.messages.getAttachmentStream(
      org.orgId,
      id,
      attachmentId,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.messages.delete(org.orgId, id);
  }
}
