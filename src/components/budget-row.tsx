import { Progress } from "@/components/ui/progress";
import { CATEGORY_COLORS, formatUyu } from "@/lib/format";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BudgetRow({ category, spent, budget }: { category: Category; spent: number; budget: number }) {
  const pct = (spent / budget) * 100;
  return (
    <li className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[category] }} />
          {category}
        </span>
        <span className={cn("tabular-nums", pct > 100 ? "font-medium text-destructive" : "text-muted-foreground")}>
          {formatUyu(spent)} / {formatUyu(budget)}
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        className={cn("h-2", pct > 100 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : pct > 85 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-emerald-500")}
      />
    </li>
  );
}
