import { categorize, merchantKey, type MerchantRule } from "@/lib/categorize";
import { getDb, getSetting, setSetting } from "@/lib/db";
import { isCategory, type Category, type Currency, type Transaction } from "@/lib/types";

interface TransactionRow {
  id: number;
  dedupe_key: string;
  source: string;
  merchant: string;
  amount: number;
  currency: Currency;
  occurred_at: string;
  local_date: string;
  card_brand: string | null;
  card_last4: string | null;
  card_type: "debito" | "credito" | null;
  category: string;
  is_demo: number;
}

function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    externalId: r.dedupe_key,
    source: r.source,
    merchant: r.merchant,
    amount: r.amount,
    currency: r.currency,
    occurredAt: r.occurred_at,
    localDate: r.local_date,
    cardBrand: r.card_brand,
    cardLast4: r.card_last4,
    cardType: r.card_type,
    category: isCategory(r.category) ? r.category : "Otros",
    isDemo: r.is_demo === 1,
  };
}

export function listTransactions(): Transaction[] {
  const rows = getDb()
    .prepare("SELECT * FROM transactions ORDER BY occurred_at DESC, id DESC")
    .all() as unknown as TransactionRow[];
  return rows.map(toTransaction);
}

export function countDemoTransactions(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM transactions WHERE is_demo = 1").get() as { n: number };
  return row.n;
}

export function clearDemoData(): number {
  return Number(getDb().prepare("DELETE FROM transactions WHERE is_demo = 1").run().changes);
}

export function getRules(): MerchantRule[] {
  const rows = getDb().prepare("SELECT pattern, category FROM merchant_rules ORDER BY pattern").all() as {
    pattern: string;
    category: string;
  }[];
  return rows.filter((r) => isCategory(r.category)) as MerchantRule[];
}

export function deleteRule(pattern: string): void {
  getDb().prepare("DELETE FROM merchant_rules WHERE pattern = ?").run(pattern);
}

/**
 * Sets a transaction's category and remembers it as a merchant rule, re-labelling every other
 * transaction from the same merchant (all branches) so history stays consistent.
 */
export function recategorizeTransaction(id: number, category: Category): { pattern: string; updated: number } {
  const db = getDb();
  const row = db.prepare("SELECT merchant FROM transactions WHERE id = ?").get(id) as { merchant: string } | undefined;
  if (!row) throw new Error("Transacción no encontrada");

  const pattern = merchantKey(row.merchant);
  const rule: MerchantRule = { pattern, category };
  const update = db.prepare("UPDATE transactions SET category = ?, category_source = 'rule' WHERE id = ?");

  db.exec("BEGIN");
  try {
    db.prepare("INSERT OR REPLACE INTO merchant_rules (pattern, category) VALUES (?, ?)").run(pattern, category);
    let updated = 0;
    const all = db.prepare("SELECT id, merchant FROM transactions").all() as { id: number; merchant: string }[];
    for (const t of all) {
      if (t.id === id || categorize(t.merchant, [rule]).source === "rule") {
        update.run(category, t.id);
        updated++;
      }
    }
    db.exec("COMMIT");
    return { pattern, updated };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getBudgets(): Partial<Record<Category, number>> {
  const rows = getDb().prepare("SELECT category, amount FROM budgets").all() as { category: string; amount: number }[];
  const out: Partial<Record<Category, number>> = {};
  for (const r of rows) if (isCategory(r.category)) out[r.category] = r.amount;
  return out;
}

export function setBudget(category: Category, amount: number | null): void {
  if (amount === null || amount <= 0) getDb().prepare("DELETE FROM budgets WHERE category = ?").run(category);
  else getDb().prepare("INSERT OR REPLACE INTO budgets (category, amount) VALUES (?, ?)").run(category, amount);
}

export const DEFAULT_USD_RATE = 40;

export function getUsdRate(): number {
  const v = Number(getSetting("usd_rate"));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_USD_RATE;
}

export function setUsdRate(rate: number): void {
  setSetting("usd_rate", String(rate));
}

export interface IngestLogEntry {
  sourceKey: string;
  source: string;
  status: string;
  detail: string | null;
  subject: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export function listIngestLog(limit = 25): IngestLogEntry[] {
  return (
    getDb()
      .prepare(
        `SELECT source_key, source, status, detail, subject, received_at, created_at
         FROM ingested_messages ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as {
      source_key: string;
      source: string;
      status: string;
      detail: string | null;
      subject: string | null;
      received_at: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    sourceKey: r.source_key,
    source: r.source,
    status: r.status,
    detail: r.detail,
    subject: r.subject,
    receivedAt: r.received_at,
    createdAt: r.created_at,
  }));
}
