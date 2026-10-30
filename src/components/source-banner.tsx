import Link from "next/link";
import { AlertTriangle, Mail, Sparkles } from "lucide-react";
import { AutoRefresh, ClearDemoButton, SyncNowButton } from "@/components/sync-controls";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { GmailStatus } from "@/lib/ingestion/gmail";

export function SourceBanner({ gmail, demoCount }: { gmail: GmailStatus; demoCount: number }) {
  return (
    <div className="space-y-3">
      {gmail.connected ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center">
          <AutoRefresh />
          <Mail className="hidden size-5 text-emerald-600 sm:block" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Gmail conectado · {gmail.account}</p>
            <p className="text-muted-foreground">
              {gmail.lastSyncAt ? `Última sincronización: ${formatDateTime(gmail.lastSyncAt)}` : "Primera sincronización en curso…"}
              {` · automática cada ${gmail.pollMinutes} min`}
            </p>
            {gmail.error && (
              <p className="mt-1 flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="size-3.5" /> {gmail.error}
              </p>
            )}
          </div>
          <SyncNowButton />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center dark:border-orange-900 dark:bg-orange-950/40">
          <Mail className="hidden size-5 text-orange-600 sm:block" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Conectá tu Gmail para importar los avisos de Itaú automáticamente</p>
            <p className="text-muted-foreground">
              {gmail.error ??
                (gmail.configured
                  ? "Solo lectura: buscamos correos de comunicaciones@itau.com.uy."
                  : "Falta configurar las credenciales de Google. Mientras tanto podés pegar o subir avisos.")}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/import">{gmail.configured ? "Conectar Gmail" : "Ver cómo configurarlo"}</Link>
          </Button>
        </div>
      )}
      {demoCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-background p-4 text-sm sm:flex-row sm:items-center">
          <Sparkles className="hidden size-5 text-violet-500 sm:block" />
          <p className="flex-1 text-muted-foreground">
            Estás viendo <span className="font-medium text-foreground">{demoCount} movimientos de demostración</span>. Borralos
            cuando empieces a importar tus avisos reales.
          </p>
          <ClearDemoButton />
        </div>
      )}
    </div>
  );
}
