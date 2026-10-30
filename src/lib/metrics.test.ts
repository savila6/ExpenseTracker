import { describe, expect, it } from "vitest";
import { computeDashboard, shiftMonth } from "./metrics";
import type { Transaction } from "./types";

let id = 0;
const tx = (localDate: string, merchant: string, amount: number, category: Transaction["category"], currency: Transaction["currency"] = "UYU"): Transaction => ({
  id: ++id,
  externalId: `t${id}`,
  source: "test",
  merchant,
  amount,
  currency,
  occurredAt: `${localDate}T12:00:00Z`,
  localDate,
  cardBrand: null,
  cardLast4: null,
  cardType: null,
  category,
  isDemo: false,
});

describe("computeDashboard", () => {
  const data = computeDashboard(
    [
      tx("2026-10-02", "TATA 1", 1000, "Supermercado"),
      tx("2026-10-05", "TATA 2", 500, "Supermercado"),
      tx("2026-10-06", "NETFLIX.COM", 10, "Entretenimiento", "USD"),
      tx("2026-09-10", "UBER TRIP", 300, "Transporte"),
    ],
    { Supermercado: 3000 },
    "2026-10",
    40,
  );

  it("totals the month in UYU, converting USD", () => {
    expect(data.total).toBe(1900);
    expect(data.previousTotal).toBe(300);
    expect(data.count).toBe(3);
    expect(data.usdOriginal).toBe(10);
  });

  it("groups merchants across branches", () => {
    expect(data.topMerchants[0]).toMatchObject({ merchant: "TATA", total: 1500, count: 2 });
  });

  it("attaches budgets and builds a 6-month trend", () => {
    expect(data.byCategory.find((c) => c.category === "Supermercado")).toMatchObject({ total: 1500, budget: 3000 });
    expect(data.trend.map((t) => t.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("shiftMonth crosses years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
