import { createHash } from "node:crypto";
import { categorize } from "@/lib/categorize";
import { getDb } from "@/lib/db";
import { parseItauEmail } from "@/lib/parser/itau";
import { getRules } from "@/lib/repo";
import type { IncomingEmail, IngestOutcome, IngestStatus } from "./types";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export function isAlreadyIngested(sourceKey: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM ingested_messages WHERE source_key = ?").get(sourceKey);
}

function record(
  incoming: IncomingEmail,
  status: IngestStatus,
  detail: string,
  transactionId: number | null = null,
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO ingested_messages (source_key, source, status, detail, subject, received_at, transaction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      incoming.sourceKey,
      incoming.source,
      status,
      detail,
      incoming.email.subject,
      incoming.email.date?.toISOString() ?? null,
      transactionId,
    );
}

export function ingestEmail(incoming: IncomingEmail): IngestOutcome {
  const subject = incoming.email.subject;
  if (isAlreadyIngested(incoming.sourceKey)) {
    return { status: "duplicate", detail: "Este correo ya fue procesado.", subject };
  }

  const result = parseItauEmail(incoming.email);
  if (!result.ok) {
    const status = result.reason === "not-a-payment" ? "ignored" : "failed";
    record(incoming, status, result.detail);
    return { status, detail: result.detail, subject };
  }

  const p = result.payment;
  const dedupeKey = incoming.email.messageId
    ? `msgid:${incoming.email.messageId}`
    : `hash:${sha256([p.merchant, p.amount, p.currency, p.occurredAt, p.cardLast4].join("|"))}`;
  const { category, source: categorySource } = categorize(p.merchant, getRules());

  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO transactions
        (dedupe_key, source, merchant, amount, currency, occurred_at, local_date, card_brand, card_last4, card_type, category, category_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      dedupeKey,
      incoming.source,
      p.merchant,
      p.amount,
      p.currency,
      p.occurredAt,
      p.localDate,
      p.cardBrand,
      p.cardLast4,
      p.cardType,
      category,
      categorySource,
    );

  if (info.changes === 0) {
    record(incoming, "duplicate", "El consumo ya existía (mismo Message-ID).");
    return { status: "duplicate", detail: "El consumo ya existía.", subject, merchant: p.merchant, amount: p.amount, currency: p.currency };
  }

  const transactionId = Number(info.lastInsertRowid);
  const detail = [`${p.merchant} · ${p.currency} ${p.amount} → ${category}`, ...p.warnings].join(" · ");
  record(incoming, "imported", detail, transactionId);
  return { status: "imported", detail, subject, transactionId, merchant: p.merchant, amount: p.amount, currency: p.currency };
}
