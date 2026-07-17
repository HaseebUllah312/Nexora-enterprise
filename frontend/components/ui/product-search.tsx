'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

interface Product { id:string; name:string; sku:string; unit:string; salePrice:string; purchasePrice:string; isRawMaterial:boolean; minimumStock?: number; stock?: Array<{quantity: string}>; }

interface Props {
  value: string;
  onChange: (productId: string, product: Product | null) => void;
  placeholder?: string;
  error?: boolean;
  rawMaterialsOnly?: boolean;
  finishedOnly?: boolean;
  quotationMode?: boolean;
}

export function ProductSearch({ value, onChange, placeholder = 'Search product...', error, rawMaterialsOnly, finishedOnly, quotationMode }: Props) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set('search', query);
        }
        if (rawMaterialsOnly) params.set('isRawMaterial', 'true');
        if (finishedOnly)     params.set('isRawMaterial', 'false');
        const data = await api.get<Product[]>(`/products?${params}`);
        // Show all products (no limit) when initial list, or first 50 if lots of results
        setResults(data.slice(0, data.length > 100 ? 50 : data.length));
        setOpen(true);
      } catch {}
    };

    const t = setTimeout(fetchProducts, 200);
    return () => clearTimeout(t);
  }, [query, rawMaterialsOnly, finishedOnly]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected && selected.id === value) return;
    api.get<Product>(`/products/${value}`).then(p => {
      setSelected(p);
    }).catch(() => {});
  }, [value, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function getStockQty(product: Product): number {
    if (!product.stock || product.stock.length === 0) return 0;
    return product.stock.reduce((total, s) => total + Number(s.quantity), 0);
  }

  function select(p: Product) {
    setSelected(p); setQuery(''); setOpen(false);
    onChange(p.id, p);
  }

  function clear() { setSelected(null); setQuery(''); onChange('', null); }

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className={`flex items-center justify-between rounded-md border ${error?'border-red-400':'border-border'} bg-background px-3 py-2`}>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{selected.sku} · {selected.unit}</p>
          </div>
          <button onClick={clear} className="ml-2 text-muted-foreground hover:text-foreground shrink-0"><X size={14}/></button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`w-full rounded-md border ${error?'border-red-400':'border-border'} bg-background pl-8 pr-10 py-2 text-sm outline-none focus:ring-2 focus:ring-primary`}
          />
          <button
            type="button"
            onClick={() => setOpen(prev => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-64 overflow-y-auto">
          {results.map(p => {
            const availableQty = getStockQty(p);
            const isOutOfStock = availableQty === 0;
            const isDisabled = isOutOfStock && !quotationMode;
            return (
            <button key={p.id} 
              onClick={() => !isDisabled && select(p)}
              disabled={isDisabled}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left border-b border-border last:border-0 ${
                isDisabled
                  ? 'bg-red-50 dark:bg-red-900/10 cursor-not-allowed opacity-60' 
                  : 'hover:bg-muted/60 cursor-pointer'
              }`}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
              </div>
              <div className="text-right ml-2 shrink-0">
                <p className="text-xs font-medium text-primary">PKR {Number(p.salePrice).toLocaleString()}</p>
                <p className={`text-xs font-semibold ${isOutOfStock ? (quotationMode ? 'text-amber-600' : 'text-red-600') : 'text-emerald-600'}`}>
                  {p.unit} · {availableQty > 0 ? `${availableQty} available` : (quotationMode ? 'No stock (Quotation OK)' : 'OUT OF STOCK')}
                </p>
              </div>
            </button>
          );
          })}
        </div>
      )}
    </div>
  );
}
