import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { QueuesModule } from './queues/queues.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrgsModule } from './orgs/orgs.module';
import { InboxesModule } from './inboxes/inboxes.module';
import { MessagesModule } from './messages/messages.module';
import { DomainsModule } from './domains/domains.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SmtpCredentialsModule } from './smtp-credentials/smtp-credentials.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SendModule } from './send/send.module';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    StorageModule,
    QueuesModule,
    EventsModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    InboxesModule,
    MessagesModule,
    DomainsModule,
    ApiKeysModule,
    SmtpCredentialsModule,
    WebhooksModule,
    SendModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
