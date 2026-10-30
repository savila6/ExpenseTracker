import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, isGmailConfigured } from "@/lib/ingestion/gmail";

export async function GET(request: NextRequest) {
  if (!isGmailConfigured()) {
    return NextResponse.redirect(new URL("/import?gmail=not-configured", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  return response;
}
