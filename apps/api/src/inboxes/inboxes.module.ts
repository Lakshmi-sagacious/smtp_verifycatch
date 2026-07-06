import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { InboxesController } from './inboxes.controller';
import { InboxesService } from './inboxes.service';

@Module({
  imports: [AuthModule],
  providers: [InboxesService, OrgAccessGuard],
  controllers: [InboxesController],
})
export class InboxesModule {}
