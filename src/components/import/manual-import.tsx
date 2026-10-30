"use client";

import { useActionState, useRef, useState } from "react";
import { CheckCircle2, CircleSlash, Copy, FileUp, Loader2, XCircle } from "lucide-react";
import { importEmailsAction, type ImportState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const STATUS_ICON = {
  imported: <CheckCircle2 className="size-4 text-emerald-600" />,
  duplicate: <Copy className="size-4 text-muted-foreground" />,
  ignored: <CircleSlash className="size-4 text-muted-foreground" />,
  failed: <XCircle className="size-4 text-destructive" />,
};

const STATUS_LABEL = { imported: "Importado", duplicate: "Ya existía", ignored: "Ignorado", failed: "No reconocido" };

export function ManualImport() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importEmailsAction, { results: [], error: null });
  const [tab, setTab] = useState("paste");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        if (tab === "paste") fd.delete("files");
        else fd.delete("text");
        await action(fd);
      }}
      className="space-y-4"
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="paste">Pegar texto</TabsTrigger>
          <TabsTrigger value="upload">Subir .eml</TabsTrigger>
        </TabsList>
        <TabsContent value="paste" forceMount className="data-[state=inactive]:hidden">
          <Label htmlFor="text" className="sr-only">
            Texto del aviso
          </Label>
          <Textarea
            id="text"
            name="text"
            rows={6}
            className="font-mono text-xs"
            placeholder={"Se aprobo un consumo de su tarjeta Visa terminada en 1234 . Realizado en TATA POCITOS Monto: 1250.00 Pesos.\n\nTambién podés pegar el código fuente completo del correo (en Gmail: ⋮ → Mostrar original)."}
          />
        </TabsContent>
        <TabsContent value="upload" forceMount className="data-[state=inactive]:hidden">
          <label
            htmlFor="files"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm hover:bg-muted/50"
          >
            <FileUp className="size-6 text-muted-foreground" />
            {fileNames.length ? (
              <span className="font-medium">{fileNames.join(", ")}</span>
            ) : (
              <>
                <span className="font-medium">Elegí uno o varios archivos .eml</span>
                <span className="text-muted-foreground">En Gmail: abrí el correo → ⋮ → Descargar mensaje</span>
              </>
            )}
            <input
              id="files"
              name="files"
              type="file"
              accept=".eml,message/rfc822"
              multiple
              className="sr-only"
              onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
            />
          </label>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Procesando…" : "Importar"}
      </Button>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.results.length > 0 && (
        <ul className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite">
          {state.results.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5">{STATUS_ICON[r.status]}</span>
              <div className="min-w-0">
                <p className="font-medium">
                  {STATUS_LABEL[r.status]} · <span className="font-normal text-muted-foreground">{r.label}</span>
                </p>
                <p className="break-words text-muted-foreground">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
