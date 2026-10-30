import { simpleParser, type AddressObject } from "mailparser";
import type { EmailMessage } from "./itau";

function addressText(addr: AddressObject | AddressObject[] | undefined): string | null {
  if (!addr) return null;
  return Array.isArray(addr) ? addr.map((a) => a.text).join(", ") : addr.text;
}

/** Parses a full RFC 822 message (.eml contents or Gmail `format=raw`). */
export async function parseRawEmail(raw: string | Buffer): Promise<EmailMessage> {
  const mail = await simpleParser(raw);
  return {
    messageId: mail.messageId ?? null,
    from: addressText(mail.from),
    subject: mail.subject ?? null,
    date: mail.date ?? null,
    html: typeof mail.html === "string" ? mail.html : null,
    text: mail.text ?? null,
  };
}

const HEADER_BLOCK = /^(?:[A-Za-z-]+:[^\n]*\n(?:[ \t][^\n]*\n)*)+\r?\n/;

/**
 * Pasted content can be a whole message (with headers) or just the visible body the user copied
 * from their mail client. Only the former goes through the MIME parser.
 */
export async function parsePastedEmail(input: string): Promise<EmailMessage> {
  const normalized = input.replace(/\r\n/g, "\n").trimStart();
  if (HEADER_BLOCK.test(normalized) && /^(from|subject|date|received|delivered-to|message-id):/im.test(normalized)) {
    return parseRawEmail(normalized);
  }
  return { messageId: null, from: null, subject: null, date: null, html: null, text: normalized };
}
