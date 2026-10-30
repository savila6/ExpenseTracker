import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRawEmail } from "@/lib/parser/eml";
import { listTransactions, recategorizeTransaction } from "@/lib/repo";
import { ingestEmail } from "./ingest";

const raw = fs.readFileSync(path.join(__dirname, "../parser/__fixtures__/itau-debit-visa-uyu.eml"));

describe("ingestEmail", () => {
  it("imports once and dedupes by source key and Message-ID", async () => {
    const email = await parseRawEmail(raw);

    const first = ingestEmail({ sourceKey: "gmail:abc", source: "gmail", email });
    expect(first.status).toBe("imported");
    expect(first.detail).toContain("Supermercado");

    expect(ingestEmail({ sourceKey: "gmail:abc", source: "gmail", email }).status).toBe("duplicate");
    expect(ingestEmail({ sourceKey: "upload:xyz", source: "upload", email }).status).toBe("duplicate");
    expect(listTransactions()).toHaveLength(1);
  });

  it("recategorizing creates a rule used by future imports", async () => {
    const [tx] = listTransactions();
    const { pattern } = recategorizeTransaction(tx.id, "Restaurantes");
    expect(pattern).toBe("FROG");

    const email = await parseRawEmail(raw);
    const outcome = ingestEmail({
      sourceKey: "gmail:def",
      source: "gmail",
      email: { ...email, messageId: "<other@x>", html: email.html!.replace("FROG\nVIS3", "FROG POC2").replace("FROG VIS3", "FROG POC2") },
    });
    expect(outcome.status).toBe("imported");
    expect(listTransactions().every((t) => t.category === "Restaurantes")).toBe(true);
  });
});
