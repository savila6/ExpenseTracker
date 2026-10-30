import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedDemoData } from "./seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('UYU','USD')),
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT,
  card_type TEXT,
  category TEXT NOT NULL,
  category_source TEXT NOT NULL DEFAULT 'keyword',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_local_date ON transactions(local_date);

CREATE TABLE IF NOT EXISTS merchant_rules (
  pattern TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ingested_messages (
  source_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('imported','duplicate','ignored','failed')),
  detail TEXT,
  subject TEXT,
  received_at TEXT,
  transaction_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ingested_created ON ingested_messages(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const globalForDb = globalThis as unknown as { __expenseDb?: DatabaseSync };

function open(): DatabaseSync {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "expense-tracker.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get();
  if (!seeded && process.env.SEED_DEMO_DATA !== "false") {
    seedDemoData(db);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('seeded', ?)").run(new Date().toISOString());
  }
  return db;
}

export function getDb(): DatabaseSync {
  globalForDb.__expenseDb ??= open();
  return globalForDb.__expenseDb;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  else getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
