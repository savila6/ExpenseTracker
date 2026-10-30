"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CATEGORY_COLORS, formatUyu } from "@/lib/format";
import type { CategoryBreakdown } from "@/lib/metrics";

export function CategoryChart({ data, total }: { data: CategoryBreakdown[]; total: number }) {
  const items = data.filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
  const config = Object.fromEntries(
    items.map((d) => [d.category, { label: d.category, color: CATEGORY_COLORS[d.category] }]),
  ) satisfies ChartConfig;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[220px]">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel formatter={(value, name) => `${name}: ${formatUyu(Number(value))}`} />}
          />
          <Pie data={items} dataKey="total" nameKey="category" innerRadius="58%" strokeWidth={2}>
            {items.map((d) => (
              <Cell key={d.category} fill={CATEGORY_COLORS[d.category]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2.5">
        {items.map((d) => (
          <li key={d.category} className="flex items-center gap-3 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[d.category] }} />
            <span className="flex-1 truncate">{d.category}</span>
            <span className="text-muted-foreground tabular-nums">{total ? Math.round((d.total / total) * 100) : 0}%</span>
            <span className="w-24 text-right font-medium tabular-nums">{formatUyu(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
