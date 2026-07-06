import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  imports: [AuthModule],
  providers: [DomainsService, OrgAccessGuard],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
