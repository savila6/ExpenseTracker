import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePastedEmail, parseRawEmail } from "./eml";
import { parseItauEmail, type EmailMessage } from "./itau";
import { htmlToText, parseAmount } from "./text";

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "__fixtures__", name));

/** Same HTML structure as the real notice, with the sentence swapped. */
function itauHtml(sentence: string): string {
  return `<html><body><table><tr><td><h3><strong>Aviso</strong></h3>
    <b>${sentence}</b><br> <br>Adem&aacute;s ingresando con tu documento y contrase&ntilde;a, a www.itau.com.uy pod&eacute;s ver el detalle.
    </td></tr></table></body></html>`;
}

function email(partial: Partial<EmailMessage>): EmailMessage {
  return {
    messageId: "<test@itau>",
    from: "Itaú Comunicaciones <comunicaciones@itau.com.uy>",
    subject: "Aviso de consumo aprobado con tarjeta de débito",
    date: new Date("2026-10-28T19:03:50Z"),
    html: null,
    text: null,
    ...partial,
  };
}

describe("real Itaú debit notice (redacted fixture)", () => {
  it("extracts every field from the .eml", async () => {
    const msg = await parseRawEmail(fixture("itau-debit-visa-uyu.eml"));
    expect(msg.subject).toBe("Aviso de consumo aprobado con tarjeta de débito");
    expect(msg.from).toContain("comunicaciones@itau.com.uy");

    const result = parseItauEmail(msg);
    expect(result).toEqual({
      ok: true,
      payment: {
        merchant: "FROG VIS3",
        amount: 90.29,
        currency: "UYU",
        occurredAt: "2026-10-28T19:03:50.000Z",
        localDate: "2026-10-28",
        cardBrand: "Visa",
        cardLast4: "0000",
        cardType: "debito",
        warnings: [],
      },
    });
  });

  it("parses the visible text a user copies from the mail client", async () => {
    const pasted = `Itaú comunica

AVISO DE CONSUMO APROBADO CON TARJETA DE DÉBITO

Se aprobo un consumo de su tarjeta Visa terminada en 0000 . Realizado en FROG
VIS3 Monto: 90.29 Pesos. Si no fuiste tú comunícate al 1784.`;
    const result = parseItauEmail(await parsePastedEmail(pasted));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payment).toMatchObject({ merchant: "FROG VIS3", amount: 90.29, currency: "UYU", cardLast4: "0000" });
    expect(result.payment.warnings).toContain("Sin fecha en el correo; se usó la fecha de importación.");
  });

  it("treats pasted full source (headers + body) as an email", async () => {
    const raw = fixture("itau-debit-visa-uyu.eml").toString("utf8");
    const msg = await parsePastedEmail(raw);
    expect(msg.messageId).toMatch(/amazonses\.com/);
    expect(parseItauEmail(msg).ok).toBe(true);
  });
});

describe("synthetic variants of the same template", () => {
  it.each([
    ["Monto: 25.99 Dólares", 25.99, "USD"],
    ["Monto: U$S 12.50", 12.5, "USD"],
    ["Monto: 1,234.50 Pesos", 1234.5, "UYU"],
    ["Monto: 1.234,50 Pesos", 1234.5, "UYU"],
    ["Monto: 2500 Pesos", 2500, "UYU"],
  ])("amount/currency %s", (monto, amount, currency) => {
    const result = parseItauEmail(
      email({ html: itauHtml(`Se aprobo un consumo de su tarjeta Visa terminada en 1111 . Realizado en NETFLIX.COM ${monto}. Si no fuiste tú comunícate al 1784.`) }),
    );
    expect(result.ok && result.payment).toMatchObject({ merchant: "NETFLIX.COM", amount, currency });
  });

  it("reads credit card notices and Mastercard brand", () => {
    const result = parseItauEmail(
      email({
        subject: "Aviso de consumo aprobado con tarjeta de crédito",
        html: itauHtml("Se aprobo un consumo de su tarjeta Mastercard terminada en 2222 . Realizado en TATA POCITOS Monto: 1840.00 Pesos."),
      }),
    );
    expect(result.ok && result.payment).toMatchObject({ cardType: "credito", cardBrand: "Mastercard", cardLast4: "2222", merchant: "TATA POCITOS" });
  });

  it("assumes UYU when the currency is missing and says so", () => {
    const result = parseItauEmail(email({ html: itauHtml("Se aprobo un consumo de su tarjeta Visa terminada en 1111 . Realizado en UTE Monto: 2100.") }));
    expect(result.ok && result.payment.currency).toBe("UYU");
    expect(result.ok && result.payment.warnings).toEqual(["Moneda no indicada; se asumió UYU."]);
  });

  it("uses a date in the body over the header date", () => {
    const result = parseItauEmail(
      email({ html: itauHtml("Se aprobo un consumo de su tarjeta Visa terminada en 1111 el 03/09/2026 a las 21:15. Realizado en ANCAP Monto: 2000 Pesos.") }),
    );
    expect(result.ok && result.payment.occurredAt).toBe("2026-09-04T00:15:00.000Z");
    expect(result.ok && result.payment.localDate).toBe("2026-09-03");
  });

  it("falls back to 'Comercio: / Importe:' layouts", () => {
    const result = parseItauEmail(email({ text: "Comercio: FARMASHOP 34 Importe: $ 540,00 Fecha: 12/10/2026" }));
    expect(result.ok && result.payment).toMatchObject({ merchant: "FARMASHOP 34", amount: 540, currency: "UYU", localDate: "2026-10-12" });
  });
});

describe("non-payments", () => {
  it("ignores rejected purchases", () => {
    const result = parseItauEmail(
      email({
        subject: "Aviso de consumo rechazado con tarjeta de débito",
        html: itauHtml("Se rechazó un consumo de su tarjeta Visa terminada en 1111 . Realizado en TATA Monto: 90 Pesos."),
      }),
    );
    expect(result).toMatchObject({ ok: false, reason: "not-a-payment" });
  });

  it("ignores marketing emails from the same sender", () => {
    const result = parseItauEmail(email({ subject: "Beneficios de octubre", html: "<p>Disfrutá 20% en restaurantes</p>" }));
    expect(result).toMatchObject({ ok: false, reason: "not-a-payment" });
  });

  it("flags payment-looking emails in an unknown format", () => {
    const result = parseItauEmail(email({ html: "<p>Se aprobo un consumo por un monto que no sabemos leer</p>" }));
    expect(result).toMatchObject({ ok: false, reason: "unrecognized" });
  });
});

describe("helpers", () => {
  it.each([
    ["90.29", 90.29],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["1.234", 1234],
    ["12,5", 12.5],
    ["abc", null],
  ])("parseAmount(%s)", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("htmlToText strips styles and decodes entities", () => {
    expect(htmlToText("<style>.a{}</style><p>Ita&uacute;<br>Monto&nbsp;10</p>")).toBe("Itaú Monto 10");
  });
});
