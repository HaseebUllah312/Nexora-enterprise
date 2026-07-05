'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { api } from '@/lib/api';

const TYPE_STYLE:Record<string,{label:string;color:string;icon:any}> = {
  STOCK_IN:{label:'Stock In',color:'text-emerald-600 bg-emerald-100',icon:TrendingUp},
  STOCK_OUT:{label:'Stock Out',color:'text-red-600 bg-red-100',icon:TrendingDown},
  SALE:{label:'Sale',color:'text-red-600 bg-red-100',icon:TrendingDown},
  PURCHASE:{label:'Purchase',color:'text-emerald-600 bg-emerald-100',icon:TrendingUp},
  TRANSFER:{label:'Transfer',color:'text-purple-600 bg-purple-100',icon:Package},
  ADJUSTMENT:{label:'Adjustment',color:'text-amber-600 bg-amber-100',icon:Package},
  PRODUCTION_CONSUMPTION:{label:'Production Used',color:'text-orange-600 bg-orange-100',icon:TrendingDown},
  PRODUCTION_OUTPUT:{label:'Production Output',color:'text-emerald-600 bg-emerald-100',icon:TrendingUp},
};

export default function StockLedgerPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    setLoading(true);
    api.get<any>(`/products/${id}/stock-ledger`).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  },[id]);

  if(loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin"/>Loading ledger...</div>;
  if(!data) return <div className="text-red-500">Product not found.</div>;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={()=>router.back()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><ArrowLeft size={14}/>Back</button>
        <div>
          <h1 className="text-xl font-bold">{data.product.name}</h1>
          <p className="text-sm text-muted-foreground">{data.product.sku} · Stock Ledger / Stock Card</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Stock</p>
          <p className="text-2xl font-bold mt-1">{data.currentStock.toLocaleString()} {data.product.unit}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Minimum Stock</p>
          <p className="text-2xl font-bold mt-1">{Number(data.product.minimumStock).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Movements</p>
          <p className="text-2xl font-bold mt-1">{data.ledger.length}</p>
        </div>
      </div>

      {/* By warehouse breakdown */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30"><h3 className="font-semibold text-sm">Stock by Warehouse</h3></div>
        <div className="divide-y divide-border">
          {data.byWarehouse.map((s:any)=>(
            <div key={s.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="font-medium text-sm">{s.warehouse.name}</p>
                <p className="text-xs text-muted-foreground">{s.branch.name}</p>
              </div>
              <p className="font-bold">{Number(s.quantity).toLocaleString()} {data.product.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Movement history */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30"><h3 className="font-semibold text-sm">Movement History</h3></div>
        {data.ledger.length===0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No stock movements recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              {['Date','Type','Quantity','Reference','Notes','Running Balance'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.ledger.map((m:any,i:number)=>{
                const style = TYPE_STYLE[m.type] ?? { label:m.type, color:'text-gray-600 bg-gray-100', icon:Package };
                const Icon = style.icon;
                return(
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(m.date).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${style.color}`}>
                        <Icon size={11}/>{style.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${m.quantity<0?'text-red-500':'text-emerald-600'}`}>
                      {m.quantity>0?'+':''}{m.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{m.referenceType??'—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{m.notes??'—'}</td>
                    <td className="px-4 py-3 font-bold">{m.runningBalance.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
