'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, TrendingUp, ArrowDownToLine, ChevronRight, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { KpiCard } from '@/components/layout/kpi-card';
import { NewSaleForm } from '@/components/forms/new-sale-form';
import { CashMemoForm } from '@/components/forms/cash-memo-form';
import { Pagination } from '@/components/ui/pagination';

interface SalesOrder {
  id:string;orderNo:string;status:string;createdAt:string;
  customer:{name:string};
  invoice:{invoiceNo:string;totalAmount:string;paidAmount:string}|null;
  _count:{items:number};
}
const STATUS_STYLE:Record<string,string>={
  QUOTATION:'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
  CONFIRMED:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INVOICED:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const PKR=(v:number|string)=>'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const PAGE_SIZE=25;

export default function SalesPage() {
  const router=useRouter();
  const [orders,setOrders]=useState<SalesOrder[]>([]);
  const [allOrders,setAll]=useState<SalesOrder[]>([]);
  const [summary,setSummary]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [statusFilter,setStatusFilter]=useState('');
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [showForm,setShowForm]=useState(false);
  const [showMemo,setShowMemo]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const[o,s]=await Promise.all([
        api.get<SalesOrder[]>('/sales/orders'+(statusFilter?`?status=${statusFilter}`:'')),
        api.get<any>('/sales/summary'),
      ]);
      setAll(o);setTotal(o.length);
      setOrders(o.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE));
      setSummary(s);
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[statusFilter,page]);

  useEffect(()=>{setPage(1);},[statusFilter]);
  useEffect(()=>{load();},[load]);

  return(
    <>
      <NewSaleForm open={showForm} onClose={()=>setShowForm(false)} onCreated={load}/>
      <CashMemoForm open={showMemo} onClose={()=>setShowMemo(false)} onCreated={load}/>

      <div className="flex flex-col gap-5">
        {summary&&(
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Today's Sales"     value={PKR(summary.todaySales)}      icon={DollarSign}/>
            <KpiCard label="Monthly Sales"     value={PKR(summary.monthlySales)}     icon={TrendingUp}/>
            <KpiCard label="Receivables"       value={PKR(summary.totalReceivables)} icon={ArrowDownToLine}/>
          </div>
        )}

        <DataTableShell title="Sales Orders & Invoices"
          description={`${total} records — click any row to view invoice, print, or record payment`}
          loading={loading} error={error}
          empty={orders.length===0} emptyLabel="No sales yet. Click 'New Invoice' to start."
          action={
            <div className="flex gap-2 flex-wrap">
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Status</option>
                {['QUOTATION','CONFIRMED','INVOICED','CANCELLED'].map(s=>(
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={()=>setShowMemo(true)}
                className="flex items-center gap-2 rounded-md border border-primary text-primary px-3 py-2 text-sm font-medium hover:bg-primary/5">
                <Receipt size={15}/>Cash Memo
              </button>
              <button onClick={()=>setShowForm(true)}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
                <Plus size={16}/>New Invoice
              </button>
            </div>
          }>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o=>{
                const outstanding=o.invoice?Number(o.invoice.totalAmount)-Number(o.invoice.paidAmount):null;
                const fullyPaid=outstanding!==null&&outstanding<=0;
                return(
                  <tr key={o.id}
                    onClick={()=>router.push(`/dashboard/sales/${o.id}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                      {o.invoice?.invoiceNo??'—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{o.orderNo}</td>
                    <td className="px-4 py-3 font-medium">{o.customer.name}</td>
                    <td className="px-4 py-3 text-center">{o._count.items}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]??''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{o.invoice?PKR(o.invoice.totalAmount):'—'}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{o.invoice?PKR(o.invoice.paidAmount):'—'}</td>
                    <td className="px-4 py-3">
                      {outstanding!==null
                        ? fullyPaid
                          ? <span className="text-xs text-emerald-600 font-medium">✓ Paid</span>
                          : <span className="font-semibold text-red-500">{PKR(outstanding)}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(o.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                    <td className="px-4 py-3"><ChevronRight size={14} className="text-muted-foreground"/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage}/>
        </DataTableShell>
      </div>
    </>
  );
}
