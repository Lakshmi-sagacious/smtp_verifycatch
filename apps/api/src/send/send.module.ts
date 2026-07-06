import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from './api-key.guard';
import { SendController } from './send.controller';
import { SendService } from './send.service';

@Module({
  imports: [ApiKeysModule],
  providers: [SendService, ApiKeyGuard],
  controllers: [SendController],
})
export class SendModule {}
