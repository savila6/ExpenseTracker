import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>}
    </div>
  );
}

export function PageSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={`Cargando ${title}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
