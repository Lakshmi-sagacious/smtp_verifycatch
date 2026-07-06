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
import { CreateApiKeySchema, type CreateApiKeyInput } from '@smtp/shared';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OrgAccessGuard, type OrgContext } from '../auth/guards/org-access.guard';
import { ZodValidationPipe } from '../common/zod.pipe';
import { ApiKeysService } from './api-keys.service';

@Controller('orgs/:orgId/api-keys')
@UseGuards(AuthGuard, OrgAccessGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.apiKeys.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateApiKeySchema)) input: CreateApiKeyInput,
  ) {
    return this.apiKeys.create(org.orgId, user.id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.apiKeys.revoke(org.orgId, id);
  }
}
