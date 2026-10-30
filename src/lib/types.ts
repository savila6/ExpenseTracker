export const CATEGORIES = [
  "Supermercado",
  "Restaurantes",
  "Transporte",
  "Combustible",
  "Salud",
  "Entretenimiento",
  "Servicios",
  "Compras",
  "Otros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Currency = "UYU" | "USD";

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export interface Transaction {
  id: number;
  externalId: string;
  source: string;
  merchant: string;
  amount: number;
  currency: Currency;
  /** ISO timestamp of the movement (taken from the notification email). */
  occurredAt: string;
  /** Local calendar date in America/Montevideo, YYYY-MM-DD. */
  localDate: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardType: "debito" | "credito" | null;
  category: Category;
  isDemo: boolean;
}
