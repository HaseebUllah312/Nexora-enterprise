'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={()=>onChange(page-1)} disabled={page===1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={14}/>
        </button>
        {pages.map((p, i) => (
          p === '...'
            ? <span key={`e${i}`} className="px-1 text-muted-foreground text-xs">…</span>
            : <button key={p} onClick={()=>onChange(p as number)}
                className={`flex h-7 min-w-7 items-center justify-center rounded-md border text-xs px-2 ${p===page?'bg-primary text-primary-foreground border-primary':'border-border hover:bg-muted'}`}>
                {p}
              </button>
        ))}
        <button onClick={()=>onChange(page+1)} disabled={page===totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight size={14}/>
        </button>
      </div>
    </div>
  );
}
