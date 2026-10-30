import type { EmailMessage } from "@/lib/parser/itau";

export type IngestStatus = "imported" | "duplicate" | "ignored" | "failed";

export interface IngestOutcome {
  status: IngestStatus;
  detail: string;
  subject: string | null;
  transactionId?: number;
  merchant?: string;
  amount?: number;
  currency?: string;
}

/** One message as delivered by any source. `sourceKey` must be stable per message (e.g. "gmail:<id>"). */
export interface IncomingEmail {
  sourceKey: string;
  source: string;
  email: EmailMessage;
}

export interface SyncReport {
  fetched: number;
  imported: number;
  duplicates: number;
  ignored: number;
  failed: number;
  error?: string;
}

export interface SourceStatus {
  configured: boolean;
  connected: boolean;
  account: string | null;
  lastSyncAt: string | null;
  lastSyncResult: SyncReport | null;
}

/**
 * A mailbox that can be polled for new Itaú notifications. Gmail implements this today;
 * an Outlook/Microsoft Graph source would implement the same contract.
 */
export interface EmailSource {
  readonly id: string;
  readonly label: string;
  status(): Promise<SourceStatus>;
  /** Fetches messages not yet ingested and pushes them through `ingestEmail`. */
  sync(): Promise<SyncReport>;
}
