const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iexcl: "¡",
  iquest: "¿",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/** Flattens an HTML email body into a single whitespace-normalized line of text. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeEntities(withoutBlocks));
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Parses amounts written either as "1.234,56" (es-UY) or "1,234.56" / "90.29" (as Itaú sends them).
 * A separator followed by exactly 1–2 trailing digits is the decimal separator; any other
 * separators are treated as thousands separators.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const lastSep = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  let normalized: string;
  if (lastSep >= 0 && /^\d{1,2}$/.test(cleaned.slice(lastSep + 1))) {
    normalized = cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + cleaned.slice(lastSep + 1);
  } else {
    normalized = cleaned.replace(/[.,]/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const MONTEVIDEO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montevideo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in Montevideo time. */
export function toLocalDate(date: Date): string {
  return MONTEVIDEO_DATE.format(date);
}
