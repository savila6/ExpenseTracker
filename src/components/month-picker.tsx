"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMonth } from "@/lib/format";

export function MonthPicker({ months, value, allowAll = false }: { months: string[]; value: string; allowAll?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = months.includes(value) || value === "all" ? months : [value, ...months];

  return (
    <Select
      value={value}
      onValueChange={(month) => {
        const params = new URLSearchParams(searchParams);
        params.set("month", month);
        router.push(`${pathname}?${params}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label="Mes">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">Todos los meses</SelectItem>}
        {options.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonth(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
