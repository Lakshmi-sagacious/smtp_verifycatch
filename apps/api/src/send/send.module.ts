import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { ApiKeyGuard } from './api-key.guard';
import { SendController } from './send.controller';
import { SendService } from './send.service';
import { SendTestController } from './send-test.controller';

@Module({
  imports: [ApiKeysModule, AuthModule],
  providers: [SendService, ApiKeyGuard, OrgAccessGuard],
  controllers: [SendController, SendTestController],
})
export class SendModule {}
