import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { SmtpCredentialsController } from './smtp-credentials.controller';
import { SmtpCredentialsService } from './smtp-credentials.service';

@Module({
  imports: [AuthModule],
  providers: [SmtpCredentialsService, OrgAccessGuard],
  controllers: [SmtpCredentialsController],
})
export class SmtpCredentialsModule {}
