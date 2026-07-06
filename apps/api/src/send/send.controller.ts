import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SendMessageSchema, type SendMessageInput } from '@smtp/shared';
import { ZodValidationPipe } from '../common/zod.pipe';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentApiKey } from './current-api-key.decorator';
import type { ApiKeyContext } from './api-key.guard';
import { SendService } from './send.service';

@Controller('send')
@UseGuards(ApiKeyGuard)
export class SendController {
  constructor(private readonly send: SendService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  submit(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Body(new ZodValidationPipe(SendMessageSchema)) input: SendMessageInput,
  ) {
    if (!apiKey.scopes.includes('send')) {
      throw new ForbiddenException('API key lacks send scope');
    }
    return this.send.send(apiKey.orgId, input);
  }
}
