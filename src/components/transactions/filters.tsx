"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { MonthPicker } from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/types";

export function TransactionFilters({ months, month }: { months: string[]; month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params}`);
  };

  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const id = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "category", "currency"].some((k) => searchParams.get(k));

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
      <div className="relative lg:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio…" className="pl-8" aria-label="Buscar comercio" />
      </div>
      <MonthPicker months={months} value={month} allowAll />
      <Select value={searchParams.get("category") ?? "all"} onValueChange={(v) => update("category", v === "all" ? null : v)}>
        <SelectTrigger className="w-full lg:w-44" aria-label="Categoría">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("currency") ?? "all"} onValueChange={(v) => update("currency", v === "all" ? null : v)}>
        <SelectTrigger className="w-full lg:w-36" aria-label="Moneda">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">UYU y USD</SelectItem>
          <SelectItem value="UYU">Solo UYU</SelectItem>
          <SelectItem value="USD">Solo USD</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            const params = new URLSearchParams();
            if (searchParams.get("month")) params.set("month", searchParams.get("month")!);
            router.replace(`${pathname}?${params}`);
          }}
        >
          <X /> Limpiar
        </Button>
      )}
    </div>
  );
}
