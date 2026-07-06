export interface MessageSummary {
  id: string;
  fromAddress: string | null;
  toAddresses: string[];
  subject: string | null;
  sizeBytes: number;
  hasAttachments: boolean;
  createdAt: string;
}

export interface MessageListResponse {
  items: MessageSummary[];
  nextCursor: string | null;
}

export interface AttachmentView {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  contentId: string | null;
}

export interface MessageDetail extends MessageSummary {
  mailFrom: string;
  rcptTo: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  messageIdHeader: string | null;
  inReplyTo: string | null;
  headers: Array<{ name: string; value: string }>;
  textBody: string | null;
  htmlBody: string | null;
  smtpAuthUser: string | null;
  clientIp: string | null;
  attachments: AttachmentView[];
  events?: MessageEventView[];
  kind: 'SANDBOX_INBOUND' | 'RELAY_OUTBOUND';
  status: string;
}

export interface MessageEventView {
  id: string;
  type: string;
  detail: unknown;
  occurredAt: string;
}

// Query filters for the org-wide logs page.
export interface MessageLogFilters {
  cursor?: string;
  limit?: number;
  kind?: 'SANDBOX_INBOUND' | 'RELAY_OUTBOUND';
  status?: string;
  domainId?: string;
  inboxId?: string;
  q?: string; // free-text over subject / from / to
}
