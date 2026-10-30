import type { Currency } from "@/lib/types";
import { htmlToText, normalizeWhitespace, parseAmount, toLocalDate } from "./text";

/** Transport-agnostic view of an email; produced from .eml files, pasted text or the Gmail API. */
export interface EmailMessage {
  messageId: string | null;
  from: string | null;
  subject: string | null;
  date: Date | null;
  html: string | null;
  text: string | null;
}

export interface ParsedPayment {
  merchant: string;
  amount: number;
  currency: Currency;
  occurredAt: string;
  localDate: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardType: "debito" | "credito" | null;
  /** Things the parser had to guess; surfaced in the import log. */
  warnings: string[];
}

export type ParseResult =
  | { ok: true; payment: ParsedPayment }
  | { ok: false; reason: "not-a-payment" | "unrecognized"; detail: string };

const ITAU_SENDER = /@itau\.com\.uy\b/i;

/** Subjects/bodies that look like a movement notice but must not be counted as spending. */
const NON_SPENDING = /\b(rechazad[oa]|denegad[oa]|no\s+aprobad[oa]|devoluci[oó]n|anulaci[oó]n|reintegro)\b/i;

const CARD = /tarjeta\s+(?:de\s+(?:d[eé]bito|cr[eé]dito)\s+)?(visa|master(?:card)?|oca|amex|american\s+express)?\s*terminada\s+en\s+(\d{4})/i;

/**
 * Body formats, tried in order. The first one is the real format observed on 2026-10-28:
 * "Se aprobo un consumo de su tarjeta Visa terminada en 1234 . Realizado en FROG VIS3 Monto: 90.29 Pesos."
 * Add new variants here when Itaú changes its template.
 */
const BODY_PATTERNS: RegExp[] = [
  /Realizado\s+en\s+(?<merchant>.+?)\s*\.?\s+Monto\s*:?\s*(?<pre>U\$S|US\$|USD|UYU|\$U|\$)?\s*(?<amount>\d(?:[\d.,]*\d)?)\s*(?<post>Pesos(?:\s+uruguayos)?|D[oó]lares(?:\s+americanos)?|USD|UYU|U\$S)?/i,
  /Comercio\s*:\s*(?<merchant>.+?)\s+(?:Importe|Monto)\s*:\s*(?<pre>U\$S|US\$|USD|UYU|\$U|\$)?\s*(?<amount>\d(?:[\d.,]*\d)?)\s*(?<post>Pesos|D[oó]lares|USD|UYU|U\$S)?/i,
  /(?:compra|consumo)\s+(?:por|de)\s+(?<pre>U\$S|US\$|USD|UYU|\$U|\$)\s*(?<amount>\d(?:[\d.,]*\d)?)\s+en\s+(?<merchant>.+?)(?:\s+(?:el\s+d[ií]a|con\s+(?:su\s+)?tarjeta)|\.\s|$)/i,
];

const BODY_DATE = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(?:a\s+las\s+)?(\d{2}):(\d{2}))?/;

function currencyFrom(pre?: string, post?: string): Currency | null {
  const token = `${pre ?? ""} ${post ?? ""}`.toLowerCase();
  if (/u\$s|us\$|usd|d[oó]lar/.test(token)) return "USD";
  if (/pesos|uyu|\$u|\$/.test(token)) return "UYU";
  return null;
}

function cleanMerchant(raw: string): string {
  return normalizeWhitespace(raw)
    .replace(/^[\s:.-]+|[\s:.,-]+$/g, "")
    .slice(0, 80);
}

export function bodyText(email: Pick<EmailMessage, "html" | "text">): string {
  if (email.html && email.html.trim()) return htmlToText(email.html);
  const text = email.text ?? "";
  return /<\w+[^>]*>/.test(text) ? htmlToText(text) : normalizeWhitespace(text);
}

export function isItauSender(from: string | null): boolean {
  return !!from && ITAU_SENDER.test(from);
}

export function parseItauEmail(email: EmailMessage): ParseResult {
  const text = bodyText(email);
  const subject = normalizeWhitespace(email.subject ?? "");
  const warnings: string[] = [];

  if (NON_SPENDING.test(subject) || NON_SPENDING.test(text.slice(0, 400))) {
    return { ok: false, reason: "not-a-payment", detail: subject || "Aviso sin consumo (rechazo o devolución)" };
  }

  let match: RegExpMatchArray | null = null;
  for (const pattern of BODY_PATTERNS) {
    match = text.match(pattern);
    if (match?.groups) break;
  }
  if (!match?.groups) {
    const looksLikePayment = /consumo|compra|d[eé]bito|monto|importe/i.test(subject + " " + text);
    return {
      ok: false,
      reason: looksLikePayment ? "unrecognized" : "not-a-payment",
      detail: looksLikePayment
        ? "Parece un aviso de pago pero el formato no coincide con ningún patrón conocido."
        : subject || "El correo no contiene un consumo.",
    };
  }

  const amount = parseAmount(match.groups.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, reason: "unrecognized", detail: `Monto inválido: "${match.groups.amount}"` };
  }

  let currency = currencyFrom(match.groups.pre, match.groups.post);
  if (!currency) {
    currency = "UYU";
    warnings.push("Moneda no indicada; se asumió UYU.");
  }

  const merchant = cleanMerchant(match.groups.merchant);
  if (!merchant) return { ok: false, reason: "unrecognized", detail: "No se encontró el comercio." };

  const card = text.match(CARD);
  const cardType = /cr[eé]dito/i.test(subject) ? "credito" : /d[eé]bito/i.test(subject) ? "debito" : null;

  let occurred: Date | null = null;
  const bodyDate = text.match(BODY_DATE);
  if (bodyDate) {
    const [, d, m, y, hh = "12", mm = "00"] = bodyDate;
    occurred = new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`);
    if (Number.isNaN(occurred.getTime())) occurred = null;
  }
  if (!occurred && email.date && !Number.isNaN(email.date.getTime())) occurred = email.date;
  if (!occurred) {
    occurred = new Date();
    warnings.push("Sin fecha en el correo; se usó la fecha de importación.");
  }

  return {
    ok: true,
    payment: {
      merchant,
      amount: Math.round(amount * 100) / 100,
      currency,
      occurredAt: occurred.toISOString(),
      localDate: toLocalDate(occurred),
      cardBrand: card?.[1] ? normalizeWhitespace(card[1]).replace(/^master$/i, "Mastercard") : null,
      cardLast4: card?.[2] ?? null,
      cardType,
      warnings,
    },
  };
}
