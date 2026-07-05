'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, BookOpen, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { CustomerForm } from '@/components/forms/customer-form';
import { Pagination } from '@/components/ui/pagination';
import { StatBadge } from '@/components/ui/stat-badge';

interface Customer {
  id:string; name:string; phone?:string; email?:string; address?:string;
  taxNumber?:string; balance:string; creditLimit:string; branchId:string;
  branch:{name:string};
}

const PKR = (v:string|number) => 'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const PAGE_SIZE = 25;

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [all,       setAll]       = useState<Customer[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Customer|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api.get<Customer[]>(`/customers${q}`);
      setAll(data); setTotal(data.length);
      setCustomers(data.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE));
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(()=>{ setPage(1); },[search]);
  useEffect(()=>{ load(); },[load]);

  const totalReceivables = all.reduce((s,c)=>s+Math.max(0,Number(c.balance)),0);
  const creditCustomers  = all.filter(c=>Number(c.creditLimit)>0).length;
  const overdueCount     = all.filter(c=>Number(c.balance)>Number(c.creditLimit)&&Number(c.creditLimit)>0).length;

  return (
    <>
      <CustomerForm open={showForm} onClose={()=>{ setShowForm(false); setEditing(null); }} onSaved={load} customer={editing}/>

      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBadge label="Total Customers"     value={all.length}              color="blue"/>
          <StatBadge label="Total Receivables"   value={PKR(totalReceivables)}   color={totalReceivables>0?'red':'green'}/>
          <StatBadge label="Credit Customers"    value={creditCustomers}         sub={overdueCount>0?`${overdueCount} over limit`:undefined} color={overdueCount>0?'amber':'default'}/>
        </div>

        <DataTableShell title="Customers"
          description="Customer accounts, credit limits, balances and transaction history"
          loading={loading} error={error}
          empty={customers.length===0} emptyLabel="No customers found."
          action={
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                  placeholder="Search name or phone..."
                  className="pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary w-48"/>
              </div>
              <button onClick={()=>{ setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
                <Plus size={16}/>Add Customer
              </button>
            </div>
          }>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                {['Name','Phone','Email','Branch','Credit Limit','Balance','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c=>{
                const overLimit = Number(c.creditLimit)>0 && Number(c.balance)>Number(c.creditLimit);
                return (
                  <tr key={c.id} className={`border-b border-border last:border-0 hover:bg-muted/40 ${overLimit?'bg-red-50/30 dark:bg-red-900/10':''}`}>
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3">{c.phone??'—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.email??'—'}</td>
                    <td className="px-4 py-3">{c.branch.name}</td>
                    <td className="px-4 py-3">
                      {Number(c.creditLimit)>0 ? PKR(c.creditLimit) : <span className="text-muted-foreground text-xs">Cash Only</span>}
                    </td>
                    <td className="px-4 py-3">
                      {Number(c.balance)>0
                        ? <span className={`font-semibold ${overLimit?'text-red-600':'text-amber-600'}`}>
                            {PKR(c.balance)}{overLimit&&' ⚠'}
                          </span>
                        : <span className="text-emerald-600 font-medium">Clear</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>router.push(`/dashboard/customers/statement?customerId=${c.id}&name=${encodeURIComponent(c.name)}`)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          <FileText size={11}/>Statement
                        </button>
                        <button onClick={()=>{ setEditing(c); setShowForm(true); }}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                          <Pencil size={11}/>Edit
                        </button>
                      </div>
                    </td>
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
