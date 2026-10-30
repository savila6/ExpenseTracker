"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearDemoAction, disconnectGmailAction, syncNowAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function SyncNowButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNowAction();
          if (r.error) toast.error("No se pudo sincronizar", { description: r.error });
          else if (r.imported) toast.success(`${r.imported} consumo(s) nuevo(s) importado(s)`);
          else toast.info("Todo al día", { description: "No hay avisos nuevos de Itaú." });
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Sincronizando…" : "Sincronizar ahora"}
    </Button>
  );
}

export function DisconnectGmailButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await disconnectGmailAction();
          toast.success("Gmail desconectado");
        })
      }
    >
      Desconectar
    </Button>
  );
}

export function ClearDemoButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { removed } = await clearDemoAction();
          toast.success(`Se borraron ${removed} movimientos de demostración`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Borrar datos demo
    </Button>
  );
}

/** Picks up rows imported by the background Gmail poll without a manual reload. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
