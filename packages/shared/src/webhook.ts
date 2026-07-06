import { z } from 'zod';

export const WebhookEventTypes = [
  'RECEIVED',
  'QUEUED',
  'SENDING',
  'DELIVERED',
  'DEFERRED',
  'BOUNCED',
  'COMPLAINED',
  'REJECTED',
  'OPENED',
  'CLICKED',
  'UNSUBSCRIBED',
  'STORED',
] as const;
export type WebhookEventType = (typeof WebhookEventTypes)[number];

export const CreateWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(WebhookEventTypes)).min(1),
});
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;

export const UpdateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(WebhookEventTypes)).min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;

export interface WebhookView {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Only returned once at creation, for the customer to store on their side for HMAC verify.
export interface WebhookWithSecret extends WebhookView {
  secret: string;
}

// The JSON body customer receives on their URL.
export interface WebhookEventPayload {
  id: string;                      // WebhookDelivery id — customer uses for de-dupe
  event: WebhookEventType;
  occurredAt: string;
  message: {
    id: string;
    orgId: string;
    kind: 'SANDBOX_INBOUND' | 'RELAY_OUTBOUND';
    status: string;
    from: string | null;
    to: string[];
    subject: string | null;
    messageIdHeader: string | null;
  };
  detail?: unknown;
}

// Header names constants — kept in sync between server (sender) and any customer SDK.
export const WebhookHeaders = {
  Signature: 'X-Webhook-Signature',
  EventId: 'X-Webhook-Event-Id',
  EventType: 'X-Webhook-Event',
  Timestamp: 'X-Webhook-Timestamp',
} as const;
