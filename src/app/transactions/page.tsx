import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SearchX } from "lucide-react";
import { PageHeader } from "@/components/page-shell";
import { CategorySelect } from "@/components/transactions/category-select";
import { TransactionFilters } from "@/components/transactions/filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeMerchant } from "@/lib/categorize";
import { currentMonth, formatDate, formatMoney, formatUyu } from "@/lib/format";
import { isMonth, monthOf, toUyu } from "@/lib/metrics";
import { getUsdRate, listTransactions } from "@/lib/repo";
import { isCategory } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = { gmail: "Gmail", upload: ".eml", paste: "Pegado", demo: "Demo" };
const PAGE_SIZE = 200;

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Movimientos" description="Cambiá la categoría de un consumo y se guarda como regla para ese comercio." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <TransactionsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TransactionsList({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const month = params.month === "all" ? "all" : isMonth(params.month) ? params.month : currentMonth();
  const category = isCategory(params.category) ? params.category : null;
  const currency = params.currency === "USD" || params.currency === "UYU" ? params.currency : null;
  const q = typeof params.q === "string" ? normalizeMerchant(params.q) : "";

  const all = listTransactions();
  const months = [...new Set(all.map((t) => monthOf(t.localDate)))].sort().reverse();
  const filtered = all.filter(
    (t) =>
      (month === "all" || monthOf(t.localDate) === month) &&
      (!category || t.category === category) &&
      (!currency || t.currency === currency) &&
      (!q || normalizeMerchant(t.merchant).includes(q)),
  );
  const usdRate = getUsdRate();
  const total = filtered.reduce((s, t) => s + toUyu(t, usdRate), 0);
  const visible = filtered.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <TransactionFilters months={months} month={month} />
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"} ·{" "}
        <span className="font-medium text-foreground">{formatUyu(total)}</span>
        {filtered.length > PAGE_SIZE && ` · mostrando los ${PAGE_SIZE} más recientes`}
      </p>

      {all.length === 0 ? (
        <Empty title="Todavía no hay movimientos" body={<>Conectá Gmail o <Link href="/import" className="underline">importá un aviso</Link>.</>} />
      ) : filtered.length === 0 ? (
        <Empty title="Ningún movimiento coincide con los filtros" body="Probá con otro mes o limpiá la búsqueda." />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 pl-4">Fecha</TableHead>
                  <TableHead>Comercio</TableHead>
                  <TableHead className="hidden md:table-cell">Tarjeta</TableHead>
                  <TableHead className="w-44">Categoría</TableHead>
                  <TableHead className="pr-4 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 text-muted-foreground tabular-nums">{formatDate(t.localDate)}</TableCell>
                    <TableCell className="max-w-48 sm:max-w-none">
                      <p className="truncate font-medium">{t.merchant}</p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        {SOURCE_LABEL[t.source] ?? t.source}
                        {t.cardLast4 && ` · ···${t.cardLast4}`}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <span className="flex items-center gap-2">
                        {t.cardBrand ?? "Tarjeta"} ···{t.cardLast4 ?? "—"}
                        <Badge variant="secondary" className="font-normal">
                          {SOURCE_LABEL[t.source] ?? t.source}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategorySelect id={t.id} category={t.category} merchant={t.merchant} />
                    </TableCell>
                    <TableCell className="pr-4 text-right font-medium whitespace-nowrap tabular-nums">
                      {formatMoney(t.amount, t.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
        <SearchX className="size-9 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
