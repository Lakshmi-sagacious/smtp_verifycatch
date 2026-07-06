import { z } from 'zod';

const emailAddress = z.string().email().max(320);

// Same shape as SendMessageInput but From is optional (defaults to noreply@<first verified domain>).
export const SendTestSchema = z
  .object({
    from: emailAddress.optional(),
    to: emailAddress,
    subject: z.string().min(1).max(998),
    text: z.string().max(500_000).optional(),
    html: z.string().max(500_000).optional(),
  })
  .refine((v) => v.text || v.html, {
    message: 'Provide at least one of text or html',
    path: ['text'],
  });
export type SendTestInput = z.infer<typeof SendTestSchema>;

export interface SendTestResponse {
  messageId: string;
  status: 'QUEUED' | 'REJECTED';
  from: string;
  reason?: string;
}
