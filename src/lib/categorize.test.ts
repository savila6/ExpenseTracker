import { describe, expect, it } from "vitest";
import { categorize, merchantKey } from "./categorize";

describe("categorize", () => {
  it.each([
    ["FROG VIS3", "Supermercado"],
    ["TATA POCITOS", "Supermercado"],
    ["UBER TRIP", "Transporte"],
    ["UBER EATS", "Restaurantes"],
    ["MERCADOLIBRE*COMPRA", "Compras"],
    ["ANCAP RAMBLA", "Combustible"],
    ["Farmashop 34", "Salud"],
    ["NETFLIX.COM", "Entretenimiento"],
    ["ANTEL", "Servicios"],
    ["PEDIDOSYA", "Restaurantes"],
    ["Café Brasilero", "Restaurantes"],
    ["UTEC", "Otros"],
    ["ALGO RARO SA", "Otros"],
  ])("%s → %s", (merchant, category) => {
    expect(categorize(merchant).category).toBe(category);
  });

  it("user rules win over keywords and cover other branches", () => {
    const rules = [{ pattern: "FROG", category: "Restaurantes" as const }];
    expect(categorize("FROG POC2", rules)).toEqual({ category: "Restaurantes", source: "rule", matched: "FROG" });
  });

  it("merchantKey drops trailing branch codes", () => {
    expect(merchantKey("FROG VIS3")).toBe("FROG");
    expect(merchantKey("Disco 12")).toBe("DISCO");
    expect(merchantKey("LA PASIVA 18 DE JULIO")).toBe("LA PASIVA 18 DE JULIO");
    expect(merchantKey("7 ELEVEN")).toBe("7 ELEVEN");
  });
});
