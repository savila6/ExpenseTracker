import { NextResponse, type NextRequest } from "next/server";
import { completeOAuth, syncGmail } from "@/lib/ingestion/gmail";

function back(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/import", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url);
  response.cookies.delete({ name: "gmail_oauth_state", path: "/api/gmail" });
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) return back(request, { gmail: "error", message: error === "access_denied" ? "Cancelaste el acceso." : error });

  const state = params.get("state");
  const expected = request.cookies.get("gmail_oauth_state")?.value;
  if (!state || !expected || state !== expected) {
    return back(request, { gmail: "error", message: "La sesión de autorización expiró. Probá de nuevo." });
  }

  const code = params.get("code");
  if (!code) return back(request, { gmail: "error", message: "Google no devolvió un código de autorización." });

  try {
    await completeOAuth(code);
  } catch (err) {
    return back(request, { gmail: "error", message: err instanceof Error ? err.message : "Error al conectar Gmail." });
  }

  void syncGmail();
  return back(request, { gmail: "connected" });
}
