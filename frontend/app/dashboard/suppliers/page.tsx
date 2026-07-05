'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { SupplierForm } from '@/components/forms/supplier-form';
import { Pagination } from '@/components/ui/pagination';
import { StatBadge } from '@/components/ui/stat-badge';

interface Supplier { id:string;name:string;phone?:string;email?:string;address?:string;taxNumber?:string;balance:string;branchId:string;branch:{name:string}; }
const PKR=(v:string|number)=>'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const PAGE_SIZE=25;

export default function SuppliersPage() {
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [all,setAll]=useState<Supplier[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Supplier|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const q=search?`?search=${encodeURIComponent(search)}`:'';
      const data=await api.get<Supplier[]>(`/suppliers${q}`);
      setAll(data);setTotal(data.length);
      setSuppliers(data.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE));
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[search,page]);

  useEffect(()=>{setPage(1);},[search]);
  useEffect(()=>{load();},[load]);

  const totalPayables=all.reduce((s,c)=>s+Math.max(0,Number(c.balance)),0);

  return(
    <>
      <SupplierForm open={showForm} onClose={()=>{setShowForm(false);setEditing(null);}} onSaved={load} supplier={editing}/>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatBadge label="Total Suppliers" value={all.length} color="blue"/>
          <StatBadge label="Total Payables"  value={PKR(totalPayables)} color={totalPayables>0?'red':'green'}/>
        </div>
        <DataTableShell title="Suppliers" description="Supplier accounts, invoices and outstanding payables"
          loading={loading} error={error} empty={suppliers.length===0} emptyLabel="No suppliers yet."
          action={
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                  placeholder="Search name or phone..."
                  className="pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary w-48"/>
              </div>
              <button onClick={()=>{setEditing(null);setShowForm(true);}}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
                <Plus size={16}/>Add Supplier
              </button>
            </div>
          }>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Name','Phone','Email','Tax No.','Branch','Balance',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{suppliers.map(s=>(
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-semibold">{s.name}</td>
                <td className="px-4 py-3">{s.phone??'—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{s.email??'—'}</td>
                <td className="px-4 py-3 text-xs">{s.taxNumber??'—'}</td>
                <td className="px-4 py-3">{s.branch.name}</td>
                <td className="px-4 py-3">
                  {Number(s.balance)>0
                    ?<span className="font-semibold text-red-600">{PKR(s.balance)}</span>
                    :<span className="text-emerald-600 font-medium text-xs">Clear</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={()=>{setEditing(s);setShowForm(true);}}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                    <Pencil size={11}/>Edit
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage}/>
        </DataTableShell>
      </div>
    </>
  );
}
