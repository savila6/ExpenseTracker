"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { recategorizeAction } from "@/app/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_COLORS } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/types";

export function CategorySelect({ id, category, merchant }: { id: number; category: Category; merchant: string }) {
  const [optimistic, setOptimistic] = useOptimistic(category);
  const [pending, start] = useTransition();

  return (
    <Select
      value={optimistic}
      disabled={pending}
      onValueChange={(value) =>
        start(async () => {
          setOptimistic(value as Category);
          const r = await recategorizeAction(id, value);
          if (!r.ok) toast.error(r.error);
          else
            toast.success(`Regla guardada: ${r.pattern} → ${value}`, {
              description:
                r.updated > 1
                  ? `Se actualizaron ${r.updated} movimientos de ${merchant} y los próximos usarán esta categoría.`
                  : "Los próximos consumos de este comercio usarán esta categoría.",
            });
        })
      }
    >
      <SelectTrigger size="sm" className="h-7 w-full min-w-36 gap-1.5 text-xs" aria-label={`Categoría de ${merchant}`}>
        <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[optimistic] }} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
