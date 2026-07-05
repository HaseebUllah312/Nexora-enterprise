'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { NewPurchaseForm } from '@/components/forms/new-purchase-form';
import { Pagination } from '@/components/ui/pagination';
import { StatBadge } from '@/components/ui/stat-badge';

interface PO { id:string;orderNo:string;status:string;createdAt:string;supplier:{name:string};invoice:{invoiceNo:string;totalAmount:string;paidAmount:string}|null;_count:{items:number}; }
const S:Record<string,string>={REQUISITION:'bg-gray-100 text-gray-600',ORDERED:'bg-blue-100 text-blue-700',RECEIVED:'bg-purple-100 text-purple-700',INVOICED:'bg-emerald-100 text-emerald-700',CANCELLED:'bg-red-100 text-red-700'};
const PKR=(v:string|number)=>'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const PAGE_SIZE=25;

export default function PurchasesPage() {
  const router=useRouter();
  const [orders,setOrders]=useState<PO[]>([]);
  const [all,setAll]=useState<PO[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [summary,setSummary]=useState<any>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const[o,s]=await Promise.all([
        api.get<PO[]>('/purchases/orders'),
        api.get<any>('/purchases/summary'),
      ]);
      setAll(o);setTotal(o.length);
      setOrders(o.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE));
      setSummary(s);
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[page]);

  useEffect(()=>{load();},[load]);

  return(
    <>
      <NewPurchaseForm open={showForm} onClose={()=>setShowForm(false)} onCreated={load}/>
      <div className="flex flex-col gap-5">
        {summary&&(
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatBadge label="Monthly Purchases" value={PKR(summary.monthlyPurchases)} color="blue"/>
            <StatBadge label="Total Purchases"   value={PKR(summary.totalPurchases)}   color="default"/>
            <StatBadge label="Total Payables"    value={PKR(summary.totalPayables)}    color={summary.totalPayables>0?'red':'green'}/>
          </div>
        )}

        <DataTableShell title="Purchases" description={`${total} records — click row for details, print PO, pay supplier`}
          loading={loading} error={error} empty={orders.length===0} emptyLabel="No purchases yet."
          action={<button onClick={()=>setShowForm(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"><Plus size={16}/>New Purchase</button>}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Invoice #','PO #','Supplier','Items','Status','Total','Paid','Outstanding','Date',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{orders.map(o=>{
              const outs=o.invoice?Number(o.invoice.totalAmount)-Number(o.invoice.paidAmount):null;
              const paid=outs!==null&&outs<=0;
              return(
                <tr key={o.id} onClick={()=>router.push(`/dashboard/purchases/${o.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{o.invoice?.invoiceNo??'—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{o.orderNo}</td>
                  <td className="px-4 py-3 font-medium">{o.supplier.name}</td>
                  <td className="px-4 py-3 text-center">{o._count.items}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${S[o.status]||''}`}>{o.status}</span></td>
                  <td className="px-4 py-3 font-medium">{o.invoice?PKR(o.invoice.totalAmount):'—'}</td>
                  <td className="px-4 py-3 text-emerald-600">{o.invoice?PKR(o.invoice.paidAmount):'—'}</td>
                  <td className="px-4 py-3">{outs!==null?(paid?<span className="text-xs text-emerald-600 font-medium">✓ Paid</span>:<span className="font-semibold text-red-500">{PKR(outs)}</span>):'—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-muted-foreground"/></td>
                </tr>
              );
            })}</tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage}/>
        </DataTableShell>
      </div>
    </>
  );
}
