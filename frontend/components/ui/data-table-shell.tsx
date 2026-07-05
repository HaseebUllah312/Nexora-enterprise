'use client';

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface DataTableShellProps {
  title: string;
  description?: string;
  action?: ReactNode;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

export function DataTableShell({
  title, description, action, loading, error, empty, emptyLabel, children,
}: DataTableShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : empty ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {emptyLabel ?? 'Nothing here yet.'}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
