import { Suspense } from "react";
import { connection } from "next/server";
import { BudgetEditorRow, DeleteRuleButton, UsdRateForm } from "@/components/budgets/budget-editor";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMonth, formatMonth, formatUyu } from "@/lib/format";
import { computeDashboard, isMonth } from "@/lib/metrics";
import { getBudgets, getRules, getUsdRate, listTransactions } from "@/lib/repo";

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader title="Presupuestos" />
          <Skeleton className="h-[480px] w-full rounded-xl" />
        </div>
      }
    >
      <Budgets searchParams={searchParams} />
    </Suspense>
  );
}

async function Budgets({ searchParams }: { searchParams: PageProps<"/budgets">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const month = isMonth(params.month) ? params.month : currentMonth();
  const usdRate = getUsdRate();
  const data = computeDashboard(listTransactions(), getBudgets(), month, usdRate);
  const rules = getRules();
  const remaining = data.budgetTotal - data.byCategory.filter((c) => c.budget).reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Presupuestos" description="Límites mensuales por categoría, en pesos uruguayos.">
        <MonthPicker months={data.availableMonths} value={month} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{formatMonth(month)}</CardTitle>
            <CardDescription>
              {data.budgetTotal
                ? remaining >= 0
                  ? `Te quedan ${formatUyu(remaining)} de ${formatUyu(data.budgetTotal)} presupuestados.`
                  : `Te pasaste ${formatUyu(-remaining)} del total presupuestado (${formatUyu(data.budgetTotal)}).`
                : "Escribí un monto para empezar a seguir una categoría. Dejalo vacío para no limitarla."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.byCategory.map((c) => (
                <BudgetEditorRow key={c.category} category={c.category} spent={c.total} budget={c.budget} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cotización del dólar</CardTitle>
              <CardDescription>Los consumos en USD se suman a los totales usando este valor.</CardDescription>
            </CardHeader>
            <CardContent>
              <UsdRateForm rate={usdRate} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reglas por comercio</CardTitle>
              <CardDescription>Se crean al cambiar la categoría de un movimiento y tienen prioridad sobre las automáticas.</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay reglas propias.</p>
              ) : (
                <ul className="space-y-1.5">
                  {rules.map((r) => (
                    <li key={r.pattern} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{r.pattern}</span>
                      <Badge variant="secondary">{r.category}</Badge>
                      <DeleteRuleButton pattern={r.pattern} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
