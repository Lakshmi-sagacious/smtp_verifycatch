import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule],
  providers: [WebhooksService, OrgAccessGuard],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
