import { z } from 'zod';

const emailAddress = z.string().email().max(320);

export const SendMessageSchema = z
  .object({
    from: emailAddress,
    to: emailAddress,
    subject: z.string().min(1).max(998),
    text: z.string().max(500_000).optional(),
    html: z.string().max(500_000).optional(),
    replyTo: emailAddress.optional(),
    // Free-form key/value headers users can attach (e.g. List-Unsubscribe).
    headers: z.record(z.string()).optional(),
  })
  .refine((v) => v.text || v.html, {
    message: 'Provide at least one of text or html',
    path: ['text'],
  });
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export interface SendMessageResponse {
  messageId: string;
  status: 'QUEUED' | 'REJECTED';
  // Populated on REJECTED (e.g. recipient suppressed, domain not verified).
  reason?: string;
}
