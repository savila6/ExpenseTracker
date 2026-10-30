import { getSetting, setSetting } from "@/lib/db";
import { parseRawEmail } from "@/lib/parser/eml";
import { ingestEmail, isAlreadyIngested } from "./ingest";
import type { EmailSource, SourceStatus, SyncReport } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const MAX_PAGES = 10;
/** Re-scan this far behind the newest message seen, in case Gmail indexes late. */
const OVERLAP_SECONDS = 2 * 24 * 3600;

export function gmailConfig() {
  const appUrl = (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 4317}`).replace(/\/$/, "");
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: `${appUrl}/api/gmail/callback`,
    query: process.env.GMAIL_QUERY ?? "from:comunicaciones@itau.com.uy",
    lookbackDays: Number(process.env.GMAIL_INITIAL_LOOKBACK_DAYS ?? 90),
    pollMinutes: Number(process.env.GMAIL_POLL_MINUTES ?? 5),
  };
}

export function isGmailConfigured(): boolean {
  const c = gmailConfig();
  return !!(c.clientId && c.clientSecret);
}

export function buildAuthUrl(state: string): string {
  const c = gmailConfig();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const c = gmailConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) throw new GmailAuthError(json.error_description ?? json.error ?? `HTTP ${res.status}`, json.error);
  return json;
}

export class GmailAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

function storeTokens(t: TokenResponse) {
  setSetting("gmail_access_token", t.access_token);
  setSetting("gmail_token_expiry", String(Date.now() + (t.expires_in - 60) * 1000));
  if (t.refresh_token) setSetting("gmail_refresh_token", t.refresh_token);
}

export async function completeOAuth(code: string): Promise<string> {
  const c = gmailConfig();
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: c.redirectUri });
  if (!tokens.refresh_token) {
    throw new GmailAuthError("Google no devolvió un refresh token. Quitá el acceso de la app en tu cuenta de Google y volvé a conectar.");
  }
  storeTokens(tokens);
  setSetting("gmail_error", null);
  const profile = (await gmailGet("/profile")) as { emailAddress: string };
  setSetting("gmail_account", profile.emailAddress);
  return profile.emailAddress;
}

async function accessToken(forceRefresh = false): Promise<string> {
  const current = getSetting("gmail_access_token");
  const expiry = Number(getSetting("gmail_token_expiry") ?? 0);
  if (current && !forceRefresh && Date.now() < expiry) return current;
  const refreshToken = getSetting("gmail_refresh_token");
  if (!refreshToken) throw new GmailAuthError("Gmail no está conectado.");
  try {
    const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
    storeTokens(t);
    return t.access_token;
  } catch (err) {
    if (err instanceof GmailAuthError && err.code === "invalid_grant") {
      clearGmailTokens();
      setSetting("gmail_error", "Google revocó el acceso. Volvé a conectar Gmail.");
    }
    throw err;
  }
}

async function gmailGet(pathAndQuery: string, retried = false): Promise<unknown> {
  const token = await accessToken(retried);
  const res = await fetch(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && !retried) return gmailGet(pathAndQuery, true);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function clearGmailTokens() {
  for (const key of ["gmail_access_token", "gmail_token_expiry", "gmail_refresh_token", "gmail_account"]) {
    setSetting(key, null);
  }
}

export async function disconnectGmail(): Promise<void> {
  const token = getSetting("gmail_refresh_token") ?? getSetting("gmail_access_token");
  if (token) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
  }
  clearGmailTokens();
  setSetting("gmail_error", null);
}

function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const syncState = globalThis as unknown as { __gmailSync?: Promise<SyncReport> };

async function runSync(): Promise<SyncReport> {
  const c = gmailConfig();
  const report: SyncReport = { fetched: 0, imported: 0, duplicates: 0, ignored: 0, failed: 0 };
  const watermark = Number(getSetting("gmail_watermark") ?? 0);
  const afterEpoch = watermark
    ? Math.floor(watermark / 1000) - OVERLAP_SECONDS
    : Math.floor(Date.now() / 1000) - c.lookbackDays * 24 * 3600;
  const q = `${c.query} after:${afterEpoch}`;

  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const list = (await gmailGet(`/messages?${params}`)) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    for (const m of list.messages ?? []) ids.push(m.id);
    pageToken = list.nextPageToken;
    if (!pageToken) break;
  }

  let newest = watermark;
  // Oldest first, so the watermark only advances past messages that were processed.
  for (const id of ids.reverse()) {
    const sourceKey = `gmail:${id}`;
    if (isAlreadyIngested(sourceKey)) {
      report.duplicates++;
      continue;
    }
    const msg = (await gmailGet(`/messages/${id}?format=raw`)) as { raw: string; internalDate: string };
    report.fetched++;
    try {
      const email = await parseRawEmail(decodeBase64Url(msg.raw));
      const outcome = ingestEmail({ sourceKey, source: "gmail", email });
      if (outcome.status === "imported") report.imported++;
      else if (outcome.status === "duplicate") report.duplicates++;
      else if (outcome.status === "ignored") report.ignored++;
      else report.failed++;
    } catch (err) {
      report.failed++;
      console.error(`[gmail] could not process message ${id}`, err);
    }
    newest = Math.max(newest, Number(msg.internalDate) || 0);
  }
  if (newest > watermark) setSetting("gmail_watermark", String(newest));
  return report;
}

export async function syncGmail(): Promise<SyncReport> {
  if (syncState.__gmailSync) return syncState.__gmailSync;
  syncState.__gmailSync = (async () => {
    let report: SyncReport;
    try {
      report = await runSync();
      setSetting("gmail_error", null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report = { fetched: 0, imported: 0, duplicates: 0, ignored: 0, failed: 0, error: message };
      setSetting("gmail_error", message);
    }
    setSetting("gmail_last_sync_at", new Date().toISOString());
    setSetting("gmail_last_sync_result", JSON.stringify(report));
    return report;
  })().finally(() => {
    syncState.__gmailSync = undefined;
  });
  return syncState.__gmailSync;
}

export function isGmailConnected(): boolean {
  return !!getSetting("gmail_refresh_token");
}

export interface GmailStatus extends SourceStatus {
  error: string | null;
  query: string;
  pollMinutes: number;
  redirectUri: string;
  syncing: boolean;
}

export function gmailStatus(): GmailStatus {
  const c = gmailConfig();
  const last = getSetting("gmail_last_sync_result");
  return {
    configured: isGmailConfigured(),
    connected: isGmailConnected(),
    account: getSetting("gmail_account"),
    lastSyncAt: getSetting("gmail_last_sync_at"),
    lastSyncResult: last ? (JSON.parse(last) as SyncReport) : null,
    error: getSetting("gmail_error"),
    query: c.query,
    pollMinutes: c.pollMinutes,
    redirectUri: c.redirectUri,
    syncing: !!syncState.__gmailSync,
  };
}

export const gmailSource: EmailSource = {
  id: "gmail",
  label: "Gmail",
  status: async () => gmailStatus(),
  sync: syncGmail,
};
