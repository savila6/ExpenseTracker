import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { BudgetRow } from "@/components/budget-row";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader, PageSkeleton } from "@/components/page-shell";
import { SourceBanner } from "@/components/source-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonth, formatMonth, formatUyu } from "@/lib/format";
import { gmailStatus } from "@/lib/ingestion/gmail";
import { computeDashboard, isMonth } from "@/lib/metrics";
import { countDemoTransactions, getBudgets, getUsdRate, listTransactions } from "@/lib/repo";
import { cn } from "@/lib/utils";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton title="Resumen" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const month = isMonth(params.month) ? params.month : currentMonth();
  const usdRate = getUsdRate();
  const data = computeDashboard(listTransactions(), getBudgets(), month, usdRate);
  const gmail = gmailStatus();
  const demoCount = countDemoTransactions();
  const delta = data.previousTotal ? ((data.total - data.previousTotal) / data.previousTotal) * 100 : null;
  const budgeted = data.byCategory.filter((c) => c.budget);
  const budgetPct = data.budgetTotal ? (budgeted.reduce((s, c) => s + c.total, 0) / data.budgetTotal) * 100 : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen" description={`Tus gastos de ${formatMonth(month).toLowerCase()}, en pesos uruguayos.`}>
        <MonthPicker months={data.availableMonths} value={month} />
      </PageHeader>

      <SourceBanner gmail={gmail} demoCount={demoCount} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gasto del mes" value={formatUyu(data.total)}>
          {delta !== null && (
            <span className={cn("inline-flex items-center gap-0.5", delta > 0 ? "text-destructive" : "text-emerald-600")}>
              {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}% vs. mes anterior
            </span>
          )}
        </Kpi>
        <Kpi label="Movimientos" value={String(data.count)}>
          Ticket promedio {formatUyu(data.averageTicket)}
        </Kpi>
        <Kpi label="Presupuesto usado" value={budgetPct === null ? "—" : `${budgetPct.toFixed(0)}%`}>
          {data.budgetTotal ? `de ${formatUyu(data.budgetTotal)}` : <Link href="/budgets" className="underline">Definir presupuestos</Link>}
        </Kpi>
        <Kpi label="Consumos en USD" value={`US$ ${data.usdOriginal.toFixed(2)}`}>
          Convertidos a $ {usdRate} por dólar
        </Kpi>
      </div>

      {data.count === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No hay consumos en {formatMonth(month).toLowerCase()}</p>
              <p className="text-sm text-muted-foreground">Sincronizá Gmail o importá un aviso de Itaú para empezar.</p>
            </div>
            <Button asChild size="sm">
              <Link href="/import">Importar avisos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Por categoría</CardTitle>
              <CardDescription>Distribución del gasto del mes</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryChart data={data.byCategory} total={data.total} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Comercios principales</CardTitle>
              <CardDescription>Donde más gastaste este mes</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {data.topMerchants.map((m, i) => (
                  <li key={m.merchant} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.category} · {m.count} {m.count === 1 ? "compra" : "compras"}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{formatUyu(m.total)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} selected={month} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle>Presupuestos</CardTitle>
              <CardDescription>Avance del mes</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/budgets">Editar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {budgeted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no definiste presupuestos. <Link href="/budgets" className="underline">Crear uno</Link>
              </p>
            ) : (
              <ul className="space-y-3.5">
                {budgeted.map((c) => (
                  <BudgetRow key={c.category} category={c.category} spent={c.total} budget={c.budget!} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}
