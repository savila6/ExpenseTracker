import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { ManualImport } from "@/components/import/manual-import";
import { PageHeader } from "@/components/page-shell";
import { AutoRefresh, DisconnectGmailButton, SyncNowButton } from "@/components/sync-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { gmailStatus, type GmailStatus } from "@/lib/ingestion/gmail";
import { listIngestLog } from "@/lib/repo";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  imported: { label: "Importado", variant: "default" },
  duplicate: { label: "Duplicado", variant: "secondary" },
  ignored: { label: "Ignorado", variant: "outline" },
  failed: { label: "No reconocido", variant: "destructive" },
};

export default function ImportPage({ searchParams }: PageProps<"/import">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar"
        description="Los avisos de consumo de Itaú llegan a tu Gmail; ExpenseTracker los lee y los convierte en movimientos."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <ImportContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ImportContent({ searchParams }: { searchParams: PageProps<"/import">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const gmail = gmailStatus();
  const log = listIngestLog(30);

  return (
    <div className="space-y-6">
      {params.gmail === "connected" && (
        <Alert>
          <CheckCircle2 className="text-emerald-600" />
          <AlertTitle>Gmail conectado</AlertTitle>
          <AlertDescription>Estamos importando tus avisos de Itaú. Esta página se actualiza sola.</AlertDescription>
        </Alert>
      )}
      {params.gmail === "error" && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>No se pudo conectar Gmail</AlertTitle>
          <AlertDescription>{typeof params.message === "string" ? params.message : "Probá de nuevo."}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GmailCard gmail={gmail} />
        <Card>
          <CardHeader>
            <CardTitle>Importación manual</CardTitle>
            <CardDescription>Para avisos sueltos o mientras no conectes Gmail.</CardDescription>
          </CardHeader>
          <CardContent>
            <ManualImport />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de importación</CardTitle>
          <CardDescription>Últimos correos procesados. Los avisos de rechazos y promociones se ignoran.</CardDescription>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se procesó ningún correo.</p>
          ) : (
            <ul className="divide-y text-sm">
              {log.map((l) => (
                <li key={l.sourceKey} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <Badge variant={STATUS_BADGE[l.status]?.variant ?? "outline"} className="w-fit shrink-0">
                    {STATUS_BADGE[l.status]?.label ?? l.status}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{l.detail}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.subject ?? "Sin asunto"} · {l.source}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GmailCard({ gmail }: { gmail: GmailStatus }) {
  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" /> Sincronización con Gmail
          <Badge variant="secondary" className="ml-auto font-normal">
            Recomendado
          </Badge>
        </CardTitle>
        <CardDescription>
          Acceso de solo lectura. Busca <code className="rounded bg-muted px-1">{gmail.query}</code> y trae los avisos nuevos cada{" "}
          {gmail.pollMinutes} minutos mientras la app está corriendo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!gmail.configured ? (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle />
              <AlertTitle>Faltan las credenciales de Google</AlertTitle>
              <AlertDescription>
                Mientras tanto la app funciona con datos de demostración y la importación manual.
              </AlertDescription>
            </Alert>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                En{" "}
                <a className="underline" href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer">
                  Google Cloud Console
                </a>{" "}
                creá un proyecto y habilitá la Gmail API.
              </li>
              <li>Configurá la pantalla de consentimiento (tipo Externo) y agregate como usuario de prueba.</li>
              <li>
                Creá un ID de cliente OAuth de tipo <em>Aplicación web</em> con este URI de redirección:
                <code className="mt-1 block rounded bg-muted px-2 py-1 break-all text-foreground">{gmail.redirectUri}</code>
              </li>
              <li>
                Copiá el ID y el secreto en <code className="rounded bg-muted px-1">.env.local</code> como{" "}
                <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> y{" "}
                <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>, y reiniciá el servidor.
              </li>
            </ol>
            <p className="text-muted-foreground">Los pasos detallados están en el README.</p>
          </div>
        ) : !gmail.connected ? (
          <div className="space-y-3">
            {gmail.error && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{gmail.error}</AlertDescription>
              </Alert>
            )}
            <p className="text-muted-foreground">
              Vas a ver la pantalla de Google para autorizar el acceso de solo lectura. Los tokens se guardan solo en esta computadora.
            </p>
            <Button asChild>
              <a href="/api/gmail/connect">
                <Mail /> Conectar Gmail
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AutoRefresh seconds={15} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Cuenta</dt>
              <dd className="font-medium">{gmail.account}</dd>
              <dt className="text-muted-foreground">Última sincronización</dt>
              <dd>{gmail.lastSyncAt ? formatDateTime(gmail.lastSyncAt) : gmail.syncing ? "En curso…" : "Nunca"}</dd>
              {gmail.lastSyncResult && !gmail.lastSyncResult.error && (
                <>
                  <dt className="text-muted-foreground">Resultado</dt>
                  <dd>
                    {gmail.lastSyncResult.imported} nuevos · {gmail.lastSyncResult.ignored} ignorados · {gmail.lastSyncResult.failed} no reconocidos
                  </dd>
                </>
              )}
            </dl>
            {gmail.error && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>La última sincronización falló</AlertTitle>
                <AlertDescription>{gmail.error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <SyncNowButton size="default" />
              <DisconnectGmailButton />
            </div>
            <p className="text-xs text-muted-foreground">
              ¿Algún aviso quedó como &quot;No reconocido&quot;? Revisalo en el historial y pegalo en la importación manual; ver{" "}
              <Link href="/transactions" className="underline">
                movimientos
              </Link>
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
