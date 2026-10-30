import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSetting, setSetting } from "@/lib/db";
import { listTransactions } from "@/lib/repo";
import { buildAuthUrl, syncGmail } from "./gmail";

const fixture = fs.readFileSync(path.join(__dirname, "../parser/__fixtures__/itau-debit-visa-uyu.eml"), "utf8");
const promo = `From: comunicaciones@itau.com.uy\nSubject: Beneficios de noviembre\nMessage-ID: <promo@itau>\nDate: Thu, 29 Oct 2026 10:00:00 +0000\nContent-Type: text/html\n\n<p>20% en restaurantes</p>`;
const b64url = (s: string) => Buffer.from(s).toString("base64url");

const messages: Record<string, { raw: string; internalDate: string }> = {
  m1: { raw: b64url(fixture), internalDate: String(Date.parse("2026-10-28T19:03:50Z")) },
  m2: { raw: b64url(promo), internalDate: String(Date.parse("2026-10-29T10:00:00Z")) },
};

describe("Gmail sync", () => {
  const calls: string[] = [];

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    setSetting("gmail_refresh_token", "refresh");
    setSetting("gmail_access_token", "access");
    setSetting("gmail_token_expiry", String(Date.now() + 3_600_000));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        const u = new URL(url);
        if (u.pathname.endsWith("/messages")) {
          return Response.json({ messages: Object.keys(messages).reverse().map((id) => ({ id })) });
        }
        const id = u.pathname.split("/").pop()!;
        return Response.json(messages[id]);
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("imports payments, ignores promos, and only fetches new messages next time", async () => {
    const first = await syncGmail();
    expect(first).toMatchObject({ fetched: 2, imported: 1, ignored: 1, failed: 0 });
    expect(listTransactions()[0]).toMatchObject({ merchant: "FROG VIS3", source: "gmail", amount: 90.29 });

    const listCall = new URL(calls.find((c) => c.includes("/messages?"))!);
    expect(listCall.searchParams.get("q")).toMatch(/^from:comunicaciones@itau\.com\.uy after:\d+$/);
    expect(getSetting("gmail_watermark")).toBe(messages.m2.internalDate);

    calls.length = 0;
    const second = await syncGmail();
    expect(second).toMatchObject({ fetched: 0, imported: 0, duplicates: 2 });
    expect(calls.filter((c) => c.includes("format=raw"))).toHaveLength(0);
  });

  it("builds a read-only offline consent URL", () => {
    const url = new URL(buildAuthUrl("xyz"));
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4317/api/gmail/callback");
  });
});
