import type { Category } from "@/lib/types";

/** Keyword → category map tuned for Montevideo merchants. Keywords match at the start of a word. */
export const DEFAULT_KEYWORDS: Record<Exclude<Category, "Otros">, string[]> = {
  Supermercado: [
    "TATA ", "DISCO ", "DEVOTO", "GEANT", "TIENDA INGLESA", "EL DORADO", "MACRO MERCADO", "MULTI AHORRO",
    "FRESH MARKET", "KINKO", "FROG", "SUPERMERCADO", "SUPER ", "AUTOSERVICE", "MINIMERCADO", "ALMACEN",
    "CARNICERIA", "VERDULERIA", "FERIA", "MERCADO AGRICOLA", "TIENDA NATURAL",
  ],
  Restaurantes: [
    "PEDIDOSYA", "PEDIDOS YA", "RAPPI", "UBER EATS", "MCDONALD", "BURGER", "STARBUCKS", "CAFE", "RESTAURANT", "RESTO",
    "PARRILLA", "PIZZ", "SUSHI", "LA PASIVA", "CHIVIT", "BAR ", "PANADERIA", "CONFITERIA", "HELADER",
    "GRIDO", "FREDDO", "LA CIGALE", "SUBWAY", "MOSCA ", "BIG MAMMA", "EMPANAD",
  ],
  Transporte: [
    "UBER ", "CABIFY", "DIDI ", "STM ", "CUTCSA", "TAXI", "PEAJE", "TELEPEAJE", "PARKING", "ESTACIONAMIENTO",
    "BUQUEBUS", "COPSA", "TURIL", "COT ", "AEROPUERTO", "AEROLINEAS", "LATAM", "IBERIA",
  ],
  Combustible: ["ANCAP", "AXION", "PETROBRAS", "DUCSA", "DISA ", "SHELL ", "ESTACION DE SERVICIO", "SERVICENTRO"],
  Salud: [
    "FARMASHOP", "FARMACIA", "SAN ROQUE", "MEDICA URUGUAYA", "CASMU", "SMI ", "HOSPITAL", "OPTICA", "ODONTO",
    "LABORATORIO", "MUCAM", "COSEM", "ASOCIACION ESPANOLA", "CUDAM", "SEMM ", "UCM ", "EMERGENCIA",
  ],
  Entretenimiento: [
    "NETFLIX", "SPOTIFY", "DISNEY", "HBO", "PRIME VIDEO", "LIFE CINEMAS", "MOVIE", "CINE ", "STEAM",
    "PLAYSTATION", "XBOX", "NINTENDO", "TICKANTEL", "REDTICKETS", "TEATRO", "ANTEL ARENA", "YOUTUBE",
  ],
  Servicios: [
    "ANTEL", "UTE ", "OSE ", "MOVISTAR", "CLARO ", "DIRECTV", "ABITAB", "REDPAGOS", "APPLE COM", "ICLOUD",
    "GOOGLE", "OPENAI", "CHATGPT", "INTENDENCIA", "IMM ", "GIMNASIO", "GYM", "LAVADERO", "TINTORERIA",
    "SEGURO", "BSE ",
  ],
  Compras: [
    "AMAZON", "MERCADOLIBRE", "MERCADO LIBRE", "ALIEXPRESS", "SHEIN", "TEMU", "ZARA", "H M", "TIENDAS MONTEVIDEO",
    "SODIMAC", "MONTEVIDEO SHOPPING", "PUNTA CARRETAS", "NUEVO CENTRO", "TRES CRUCES", "PERFUMERIA",
    "LOS DOS CHINOS", "TIENDA", "ROPA", "NIKE", "ADIDAS", "APPLE STORE", "BAS ", "MULTIAHORRO HOGAR",
  ],
};

/** Uppercase, accent-free, alphanumerics separated by single spaces. */
export function normalizeMerchant(merchant: string): string {
  return merchant
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Key used for user merchant rules. Itaú appends branch/terminal codes ("FROG VIS3",
 * "TATA 123"), so trailing tokens containing digits are dropped to make one rule cover every branch.
 */
export function merchantKey(merchant: string): string {
  const tokens = normalizeMerchant(merchant).split(" ").filter(Boolean);
  while (tokens.length > 1 && /\d/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

function wordPrefixMatch(haystack: string, needle: string): boolean {
  const n = normalizeMerchant(needle);
  if (!n) return false;
  const trailingSpace = needle.endsWith(" ");
  const h = ` ${haystack} `;
  return trailingSpace ? h.includes(` ${n} `) : h.includes(` ${n}`);
}

export interface MerchantRule {
  pattern: string;
  category: Category;
}

export interface CategorizeResult {
  category: Category;
  source: "rule" | "keyword" | "fallback";
  matched: string | null;
}

export function categorize(merchant: string, userRules: MerchantRule[] = []): CategorizeResult {
  const normalized = normalizeMerchant(merchant);

  let best: { rule: MerchantRule; len: number } | null = null;
  for (const rule of userRules) {
    if (wordPrefixMatch(normalized, rule.pattern) && (!best || rule.pattern.length > best.len)) {
      best = { rule, len: rule.pattern.length };
    }
  }
  if (best) return { category: best.rule.category, source: "rule", matched: best.rule.pattern };

  let bestKeyword: { category: Category; keyword: string } | null = null;
  for (const [category, keywords] of Object.entries(DEFAULT_KEYWORDS) as [Category, string[]][]) {
    for (const keyword of keywords) {
      if (wordPrefixMatch(normalized, keyword) && (!bestKeyword || keyword.length > bestKeyword.keyword.length)) {
        bestKeyword = { category, keyword };
      }
    }
  }
  if (bestKeyword) return { category: bestKeyword.category, source: "keyword", matched: bestKeyword.keyword.trim() };

  return { category: "Otros", source: "fallback", matched: null };
}
