import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgAccessGuard } from '../auth/guards/org-access.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuthModule],
  providers: [ApiKeysService, OrgAccessGuard],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
