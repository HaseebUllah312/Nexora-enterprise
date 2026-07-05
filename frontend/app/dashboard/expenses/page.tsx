'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, TrendingDown, Wallet, PieChart } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { getCurrentUser } from '@/lib/auth';

interface Expense {
  id:string; expenseNo:string; title:string; category:string; amount:string;
  paidFrom:string; description?:string; expenseDate:string; branch:{name:string};
}

const CATEGORIES = ['UTILITIES','RENT','SALARY','TRANSPORT','MAINTENANCE','MARKETING','MISCELLANEOUS','OTHER'];
const CAT_COLORS: Record<string,string> = {
  UTILITIES:'bg-blue-100 text-blue-700',RENT:'bg-purple-100 text-purple-700',
  SALARY:'bg-green-100 text-green-700',TRANSPORT:'bg-yellow-100 text-yellow-700',
  MAINTENANCE:'bg-orange-100 text-orange-700',MARKETING:'bg-pink-100 text-pink-700',
  MISCELLANEOUS:'bg-gray-100 text-gray-600',OTHER:'bg-slate-100 text-slate-600',
};
const PKR = (v:number|string) => 'PKR ' + Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});

export default function ExpensesPage() {
  const user = getCurrentUser();
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [summary,   setSummary]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [filters,   setFilters]   = useState({ from:'', to:'', category:'' });
  const [branches,  setBranches]  = useState<{id:string;name:string}[]>([]);

  const blank = { title:'', category:'UTILITIES', amount:'', paidFrom:'CASH', branchId: user?.branch?.id??'', description:'', expenseDate: new Date().toISOString().slice(0,10) };
  const [form,    setForm]    = useState(blank);
  const [fErr,    setFErr]    = useState<Record<string,string>>({});
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.from)     params.set('from', filters.from);
      if (filters.to)       params.set('to', filters.to);
      if (filters.category) params.set('category', filters.category);
      const [exp, sum] = await Promise.all([
        api.get<Expense[]>(`/expenses?${params}`),
        api.get<any>('/expenses/summary'),
      ]);
      setExpenses(exp); setSummary(sum);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{id:string;name:string}[]>('/branches').then(setBranches).catch(()=>{});
  }, []);

  function set(f:string,v:string){ setForm(p=>({...p,[f]:v})); setFErr(p=>({...p,[f]:''})); }

  async function save() {
    const e:Record<string,string> = {};
    if (!form.title.trim())               e.title    = 'Title required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter valid amount';
    if (!form.branchId)                   e.branchId = 'Select branch';
    setFErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount), expenseDate: new Date(form.expenseDate).toISOString() });
      setShowForm(false); setForm(blank); load();
    } catch (err:any) { setFErr({ submit: err.message }); }
    finally { setSaving(false); }
  }

  async function remove(id:string) {
    if (!confirm('Delete this expense?')) return;
    try { await api.delete(`/expenses/${id}`); load(); } catch (e:any) { alert(e.message); }
  }

  return (
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Record Expense" subtitle="Log a business expense" width="max-w-lg">
        <div className="flex flex-col gap-4">
          <Field label="Expense Title" required error={fErr.title}>
            <Input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Electricity Bill — March 2024" error={!!fErr.title}/>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required>
              <Select value={form.category} onChange={e=>set('category',e.target.value)}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Amount (PKR)" required error={fErr.amount}>
              <Input type="number" min={1} value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="5000" error={!!fErr.amount}/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Paid From">
              <Select value={form.paidFrom} onChange={e=>set('paidFrom',e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.expenseDate} onChange={e=>set('expenseDate',e.target.value)}/>
            </Field>
          </div>
          <Field label="Branch" required error={fErr.branchId}>
            <Select value={form.branchId} onChange={e=>set('branchId',e.target.value)} error={!!fErr.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Description / Notes">
            <Input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Optional details..."/>
          </Field>
          {fErr.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label="Record Expense" onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col gap-5">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600"><TrendingDown size={20}/></div>
              <div><p className="text-xs text-muted-foreground uppercase tracking-wide">This Month</p><p className="text-xl font-bold">{PKR(summary.monthlyExpenses)}</p></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600"><Wallet size={20}/></div>
              <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</p><p className="text-xl font-bold">{PKR(summary.totalExpenses)}</p></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2"><PieChart size={16} className="text-muted-foreground"/><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Category</p></div>
              <div className="flex flex-wrap gap-1.5">
                {summary.byCategory?.slice(0,4).map((c:any)=>(
                  <span key={c.category} className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[c.category]||'bg-gray-100 text-gray-600'}`}>
                    {c.category}: {PKR(c.total)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <DataTableShell title="Expenses" description="Business expenses — rent, utilities, salaries, transport, maintenance"
          loading={loading} error={error} empty={expenses.length===0} emptyLabel="No expenses recorded yet."
          action={
            <div className="flex gap-2 flex-wrap">
              <input type="date" value={filters.from} onChange={e=>setFilters(p=>({...p,from:e.target.value}))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
              <input type="date" value={filters.to} onChange={e=>setFilters(p=>({...p,to:e.target.value}))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
              <Select value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))} className="w-36">
                <option value="">All Categories</option>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </Select>
              <button onClick={()=>setShowForm(true)}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
                <Plus size={16}/>Add Expense
              </button>
            </div>
          }>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Ref #','Title','Category','Branch','Paid From','Amount','Date',''].map(h=>(
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.expenseNo}</td>
                  <td className="px-4 py-3 font-medium">
                    {e.title}
                    {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[e.category]||'bg-gray-100 text-gray-600'}`}>{e.category}</span>
                  </td>
                  <td className="px-4 py-3">{e.branch.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${e.paidFrom==='CASH'?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'}`}>{e.paidFrom}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600">{PKR(e.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(e.expenseDate).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3">
                    <button onClick={()=>remove(e.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </div>
    </>
  );
}
