"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <AlertTriangle className="size-10 text-destructive" />
        <div>
          <p className="font-medium">Algo salió mal al cargar esta página</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {error.message || "Error inesperado."} Si persiste, revisá que la carpeta <code>data/</code> tenga permisos de escritura.
          </p>
        </div>
        <Button onClick={reset}>Reintentar</Button>
      </CardContent>
    </Card>
  );
}
