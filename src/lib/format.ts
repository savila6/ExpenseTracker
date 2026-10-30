import type { Category, Currency } from "@/lib/types";

const uyu = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
const uyuCents = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 2 });
const usd = new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function formatUyu(value: number): string {
  return uyu.format(Math.round(value));
}

export function formatMoney(amount: number, currency: Currency): string {
  return currency === "USD" ? usd.format(amount) : uyuCents.format(amount);
}

export function formatMonth(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-UY", {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDate(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Montevideo",
  }).format(new Date(iso));
}

export function currentMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Supermercado: "oklch(0.65 0.17 150)",
  Restaurantes: "oklch(0.7 0.17 50)",
  Transporte: "oklch(0.62 0.15 250)",
  Combustible: "oklch(0.6 0.2 25)",
  Salud: "oklch(0.68 0.13 190)",
  Entretenimiento: "oklch(0.6 0.2 310)",
  Servicios: "oklch(0.72 0.14 90)",
  Compras: "oklch(0.6 0.16 280)",
  Otros: "oklch(0.65 0.02 260)",
};
