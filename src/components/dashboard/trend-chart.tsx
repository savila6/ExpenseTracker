"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatMonth, formatUyu } from "@/lib/format";

const config = { total: { label: "Gasto", color: "oklch(0.7 0.18 50)" } } satisfies ChartConfig;

export function TrendChart({ data, selected }: { data: { month: string; total: number }[]; selected: string }) {
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month, "short") }));
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator formatter={(value) => formatUyu(Number(value))} />}
        />
        <Bar dataKey="total" radius={6}>
          {rows.map((r) => (
            <Cell key={r.month} fill="var(--color-total)" fillOpacity={r.month === selected ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
