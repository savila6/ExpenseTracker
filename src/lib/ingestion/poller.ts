import { gmailConfig, isGmailConfigured, isGmailConnected, syncGmail } from "./gmail";

const state = globalThis as unknown as { __gmailPoller?: NodeJS.Timeout };

export function startGmailPoller(): void {
  if (state.__gmailPoller) return;
  const minutes = gmailConfig().pollMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  const tick = async () => {
    if (!isGmailConfigured() || !isGmailConnected()) return;
    const report = await syncGmail();
    if (report.error) console.warn(`[gmail] background sync failed: ${report.error}`);
    else if (report.imported) console.log(`[gmail] background sync imported ${report.imported} payment(s)`);
  };

  state.__gmailPoller = setInterval(() => void tick(), minutes * 60_000);
  state.__gmailPoller.unref?.();
  setTimeout(() => void tick(), 10_000).unref?.();
  console.log(`[gmail] background sync every ${minutes} min (runs only while Gmail is connected)`);
}
