"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteRuleAction, setBudgetAction, setUsdRateAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CATEGORY_COLORS, formatUyu } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BudgetEditorRow({ category, spent, budget }: { category: Category; spent: number; budget: number | null }) {
  const [value, setValue] = useState(budget ? String(budget) : "");
  const [pending, start] = useTransition();
  const parsed = value.trim() === "" ? null : Number(value.replace(/[^\d.]/g, ""));
  const dirty = parsed !== budget && !(parsed === null && budget === null);
  const pct = budget ? (spent / budget) * 100 : 0;

  const save = () =>
    start(async () => {
      const r = await setBudgetAction(category, parsed);
      if (!r.ok) toast.error(r.error);
      else toast.success(parsed ? `Presupuesto de ${category}: ${formatUyu(parsed)}` : `Quitaste el presupuesto de ${category}`);
    });

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <span className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[category] }} />
            {category}
          </span>
          <span className={cn("tabular-nums", pct > 100 ? "font-medium text-destructive" : "text-muted-foreground")}>
            {formatUyu(spent)}
            {budget ? ` de ${formatUyu(budget)} · ${pct.toFixed(0)}%` : " · sin presupuesto"}
          </span>
        </div>
        <Progress
          value={budget ? Math.min(pct, 100) : 0}
          className={cn(
            "h-2",
            pct > 100
              ? "[&>[data-slot=progress-indicator]]:bg-destructive"
              : pct > 85
                ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
                : "[&>[data-slot=progress-indicator]]:bg-emerald-500",
          )}
        />
        {budget && pct > 100 && <p className="text-xs text-destructive">Te pasaste por {formatUyu(spent - budget)}</p>}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        <div className="relative w-full sm:w-36">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Sin límite"
            className="pl-6 tabular-nums"
            aria-label={`Presupuesto mensual de ${category}`}
          />
        </div>
        <Button type="submit" size="icon" variant={dirty ? "default" : "outline"} disabled={!dirty || pending} aria-label="Guardar">
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
      </form>
    </li>
  );
}

export function UsdRateForm({ rate }: { rate: number }) {
  const [value, setValue] = useState(String(rate));
  const [pending, start] = useTransition();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setUsdRateAction(Number(value.replace(",", ".")));
          if (!r.ok) toast.error(r.error);
          else toast.success(`Cotización actualizada: $ ${value} por US$ 1`);
        });
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-28 tabular-nums" aria-label="Pesos por dólar" />
      <Button type="submit" variant="outline" disabled={pending || Number(value) === rate}>
        Guardar
      </Button>
    </form>
  );
}

export function DeleteRuleButton({ pattern }: { pattern: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Borrar regla ${pattern}`}
      onClick={() =>
        start(async () => {
          await deleteRuleAction(pattern);
          toast.success(`Regla "${pattern}" eliminada`, { description: "Los movimientos existentes mantienen su categoría." });
        })
      }
    >
      <X />
    </Button>
  );
}
