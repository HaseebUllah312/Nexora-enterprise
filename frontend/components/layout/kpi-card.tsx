import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
}

export function KpiCard({ label, value, icon: Icon, trend }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="mt-1.5 text-2xl font-bold leading-tight">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 ml-2 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={18}/>
        </div>
      </div>
      {trend && (
        <p className={`mt-2.5 text-xs font-medium ${trend.positive?'text-emerald-500':'text-red-500'}`}>
          {trend.positive?'↑':'↓'} {trend.value}
        </p>
      )}
    </div>
  );
}
