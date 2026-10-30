import type { DatabaseSync } from "node:sqlite";
import { categorize } from "./categorize";
import { toLocalDate } from "./parser/text";
import type { Category, Currency } from "./types";

interface DemoMerchant {
  name: string;
  currency: Currency;
  min: number;
  max: number;
  perMonth: number;
}

const DEMO_MERCHANTS: DemoMerchant[] = [
  { name: "TATA POCITOS", currency: "UYU", min: 450, max: 2800, perMonth: 5 },
  { name: "DISCO 12", currency: "UYU", min: 600, max: 3900, perMonth: 3 },
  { name: "FROG VIS3", currency: "UYU", min: 60, max: 420, perMonth: 4 },
  { name: "TIENDA INGLESA MALVIN", currency: "UYU", min: 900, max: 5200, perMonth: 2 },
  { name: "PEDIDOSYA", currency: "UYU", min: 380, max: 1450, perMonth: 4 },
  { name: "LA PASIVA 18 DE JULIO", currency: "UYU", min: 420, max: 1100, perMonth: 1 },
  { name: "STARBUCKS PUNTA CARRETAS", currency: "UYU", min: 190, max: 420, perMonth: 3 },
  { name: "UBER TRIP", currency: "UYU", min: 180, max: 690, perMonth: 6 },
  { name: "STM RECARGA", currency: "UYU", min: 300, max: 600, perMonth: 1 },
  { name: "ANCAP RAMBLA", currency: "UYU", min: 1500, max: 2900, perMonth: 2 },
  { name: "FARMASHOP 34", currency: "UYU", min: 220, max: 1800, perMonth: 2 },
  { name: "NETFLIX.COM", currency: "USD", min: 10.99, max: 10.99, perMonth: 1 },
  { name: "SPOTIFY", currency: "USD", min: 5.99, max: 5.99, perMonth: 1 },
  { name: "LIFE CINEMAS ALFABETA", currency: "UYU", min: 380, max: 900, perMonth: 1 },
  { name: "ANTEL", currency: "UYU", min: 1490, max: 1490, perMonth: 1 },
  { name: "UTE", currency: "UYU", min: 1900, max: 3400, perMonth: 1 },
  { name: "AMAZON MKTPLACE", currency: "USD", min: 18, max: 120, perMonth: 1 },
  { name: "ZARA MONTEVIDEO SHOPPING", currency: "UYU", min: 1200, max: 4500, perMonth: 1 },
  { name: "PANADERIA LA ESPIGA", currency: "UYU", min: 90, max: 380, perMonth: 3 },
  { name: "PAYPAL *VARIOS", currency: "USD", min: 8, max: 45, perMonth: 1 },
];

export const DEFAULT_BUDGETS: Partial<Record<Category, number>> = {
  Supermercado: 22000,
  Restaurantes: 9000,
  Transporte: 5000,
  Combustible: 6000,
  Salud: 3000,
  Entretenimiento: 3000,
  Servicios: 6500,
  Compras: 6000,
};

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDemoData(db: DatabaseSync, now = new Date()): void {
  const rand = prng(20261030);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (dedupe_key, source, merchant, amount, currency, occurred_at, local_date, card_brand, card_last4, card_type, category, category_source, is_demo)
    VALUES (?, 'demo', ?, ?, ?, ?, ?, 'Visa', '0000', 'debito', ?, ?, 1)
  `);
  const insertBudget = db.prepare("INSERT OR IGNORE INTO budgets (category, amount) VALUES (?, ?)");

  db.exec("BEGIN");
  try {
    let n = 0;
    for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1, 15));
      const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
      const lastDay = monthsBack === 0 ? now.getUTCDate() : daysInMonth;
      for (const m of DEMO_MERCHANTS) {
        const count = Math.max(0, Math.round(m.perMonth * (0.6 + rand() * 0.8)));
        for (let i = 0; i < count; i++) {
          const day = 1 + Math.floor(rand() * lastDay);
          const when = new Date(monthStart);
          when.setUTCDate(day);
          when.setUTCHours(11 + Math.floor(rand() * 12), Math.floor(rand() * 60));
          if (when > now) continue;
          const raw = m.min + rand() * (m.max - m.min);
          const amount = m.currency === "USD" ? Math.round(raw * 100) / 100 : Math.round(raw);
          const { category, source } = categorize(m.name);
          insert.run(`demo:${n++}`, m.name, amount, m.currency, when.toISOString(), toLocalDate(when), category, source);
        }
      }
    }
    for (const [category, amount] of Object.entries(DEFAULT_BUDGETS)) insertBudget.run(category, amount);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
