import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule],
  providers: [MessagesService, OrgAccessGuard],
  controllers: [MessagesController],
})
export class MessagesModule {}
