"use server";

import { revalidatePath } from "next/cache";
import { sha256, ingestEmail } from "@/lib/ingestion/ingest";
import { disconnectGmail, isGmailConfigured, isGmailConnected, syncGmail } from "@/lib/ingestion/gmail";
import type { IngestOutcome, SyncReport } from "@/lib/ingestion/types";
import { parsePastedEmail, parseRawEmail } from "@/lib/parser/eml";
import { clearDemoData, deleteRule, recategorizeTransaction, setBudget, setUsdRate } from "@/lib/repo";
import { isCategory } from "@/lib/types";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function refreshAll() {
  revalidatePath("/", "layout");
}

export interface ImportState {
  results: (IngestOutcome & { label: string })[];
  error: string | null;
}

export async function importEmailsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const results: ImportState["results"] = [];
  const text = String(formData.get("text") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    return { results, error: "Pegá el texto de un aviso o elegí al menos un archivo .eml." };
  }

  try {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        results.push({ label: file.name, status: "failed", detail: "Archivo demasiado grande (máx. 2 MB).", subject: null });
        continue;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const email = await parseRawEmail(buffer);
      const key = email.messageId ? `upload:${email.messageId}` : `upload:${sha256(buffer.toString("utf8"))}`;
      results.push({ label: file.name, ...ingestEmail({ sourceKey: key, source: "upload", email }) });
    }
    if (text) {
      const email = await parsePastedEmail(text);
      const key = email.messageId ? `paste:${email.messageId}` : `paste:${sha256(text)}`;
      results.push({ label: "Texto pegado", ...ingestEmail({ sourceKey: key, source: "paste", email }) });
    }
  } catch (err) {
    console.error(err);
    return { results, error: "No se pudo leer el correo. ¿Es un .eml válido?" };
  }

  refreshAll();
  return { results, error: null };
}

export async function syncNowAction(): Promise<SyncReport> {
  if (!isGmailConfigured() || !isGmailConnected()) {
    return { fetched: 0, imported: 0, duplicates: 0, ignored: 0, failed: 0, error: "Gmail no está conectado." };
  }
  const report = await syncGmail();
  refreshAll();
  return report;
}

export async function disconnectGmailAction(): Promise<void> {
  await disconnectGmail();
  refreshAll();
}

export async function recategorizeAction(id: number, category: string) {
  if (!isCategory(category)) return { ok: false as const, error: "Categoría inválida" };
  try {
    const result = recategorizeTransaction(id, category);
    refreshAll();
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error al recategorizar" };
  }
}

export async function setBudgetAction(category: string, amount: number | null) {
  if (!isCategory(category)) return { ok: false as const, error: "Categoría inválida" };
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { ok: false as const, error: "Monto inválido" };
  setBudget(category, amount);
  refreshAll();
  return { ok: true as const };
}

export async function setUsdRateAction(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false as const, error: "Cotización inválida" };
  setUsdRate(rate);
  refreshAll();
  return { ok: true as const };
}

export async function clearDemoAction() {
  const removed = clearDemoData();
  refreshAll();
  return { removed };
}

export async function deleteRuleAction(pattern: string) {
  deleteRule(pattern);
  refreshAll();
}
