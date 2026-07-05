'use client';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'red' | 'amber' | 'blue' | 'default';
}

const COLORS = {
  green:   'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400',
  red:     'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
  amber:   'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
  blue:    'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
  default: 'bg-muted border-border text-foreground',
};

export function StatBadge({ label, value, sub, color = 'default' }: Props) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${COLORS[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}
