import { merchantKey } from "@/lib/categorize";
import { CATEGORIES, type Category, type Transaction } from "@/lib/types";

export function toUyu(t: Pick<Transaction, "amount" | "currency">, usdRate: number): number {
  return t.currency === "USD" ? t.amount * usdRate : t.amount;
}

export function monthOf(localDate: string): string {
  return localDate.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export interface CategoryBreakdown {
  category: Category;
  total: number;
  count: number;
  budget: number | null;
}

export interface MerchantTotal {
  merchant: string;
  total: number;
  count: number;
  category: Category;
}

export interface DashboardData {
  month: string;
  total: number;
  previousTotal: number;
  count: number;
  averageTicket: number;
  usdOriginal: number;
  budgetTotal: number;
  byCategory: CategoryBreakdown[];
  topMerchants: MerchantTotal[];
  trend: { month: string; total: number }[];
  availableMonths: string[];
}

export function computeDashboard(
  transactions: Transaction[],
  budgets: Partial<Record<Category, number>>,
  month: string,
  usdRate: number,
  trendMonths = 6,
): DashboardData {
  const totalsByMonth = new Map<string, number>();
  for (const t of transactions) {
    const m = monthOf(t.localDate);
    totalsByMonth.set(m, (totalsByMonth.get(m) ?? 0) + toUyu(t, usdRate));
  }

  const inMonth = transactions.filter((t) => monthOf(t.localDate) === month);
  const total = inMonth.reduce((s, t) => s + toUyu(t, usdRate), 0);

  const byCategory: CategoryBreakdown[] = CATEGORIES.map((category) => {
    const items = inMonth.filter((t) => t.category === category);
    return {
      category,
      total: items.reduce((s, t) => s + toUyu(t, usdRate), 0),
      count: items.length,
      budget: budgets[category] ?? null,
    };
  });

  const merchants = new Map<string, MerchantTotal>();
  for (const t of inMonth) {
    const key = merchantKey(t.merchant);
    const current = merchants.get(key) ?? { merchant: key, total: 0, count: 0, category: t.category };
    current.total += toUyu(t, usdRate);
    current.count += 1;
    merchants.set(key, current);
  }

  const trend = Array.from({ length: trendMonths }, (_, i) => {
    const m = shiftMonth(month, i - (trendMonths - 1));
    return { month: m, total: totalsByMonth.get(m) ?? 0 };
  });

  return {
    month,
    total,
    previousTotal: totalsByMonth.get(shiftMonth(month, -1)) ?? 0,
    count: inMonth.length,
    averageTicket: inMonth.length ? total / inMonth.length : 0,
    usdOriginal: inMonth.filter((t) => t.currency === "USD").reduce((s, t) => s + t.amount, 0),
    budgetTotal: Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0),
    byCategory,
    topMerchants: [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    trend,
    availableMonths: [...totalsByMonth.keys()].sort().reverse(),
  };
}
