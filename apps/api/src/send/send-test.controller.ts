import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SendTestSchema, type SendTestInput, type SendTestResponse } from '@smtp/shared';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { SendService } from './send.service';

@Controller('orgs/:orgId/send-test')
@UseGuards(AuthGuard, OrgAccessGuard)
export class SendTestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendService: SendService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async sendTest(
    @CurrentOrg() org: OrgContext,
    @Body(new ZodValidationPipe(SendTestSchema)) input: SendTestInput,
  ): Promise<SendTestResponse> {
    // If From is provided, use it. Otherwise pick the first verified domain and use noreply@<domain>.
    let from = input.from;
    if (!from) {
      const domain = await this.prisma.domain.findFirst({
        where: { orgId: org.orgId, verificationStatus: 'VERIFIED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!domain) {
        throw new BadRequestException(
          'No verified sending domain — add one in Domains and click Verify first, or provide a From address explicitly.',
        );
      }
      from = `noreply@${domain.name}`;
    }

    const result = await this.sendService.send(org.orgId, {
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return {
      messageId: result.messageId,
      status: result.status,
      from,
      reason: result.reason,
    };
  }
}
