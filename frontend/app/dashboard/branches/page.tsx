'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Building2, Users, Warehouse, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { BranchForm } from '@/components/forms/branch-form';

interface Branch { id:string; name:string; code:string; city?:string; phone?:string; isMainBranch:boolean; isActive:boolean; address?:string; _count:{users:number;warehouses:number}; }

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Branch|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBranches(await api.get<Branch[]>('/branches')); }
    catch (e:any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <BranchForm open={showForm} onClose={()=>{setShowForm(false);setEditing(null);}} onSaved={load} branch={editing}/>
      <DataTableShell title="Branches" description="Multi-branch network — each branch has separate stock, sales and accounts"
        loading={loading} error={error} empty={branches.length===0} emptyLabel="No branches configured."
        action={
          <button onClick={()=>{setEditing(null);setShowForm(true);}}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
            <Plus size={16}/> Add Branch
          </button>
        }>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map(b => (
            <div key={b.id} className="rounded-lg border border-border bg-background p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-primary shrink-0"/>
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {b.code}{b.city && ` · ${b.city}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {b.isMainBranch && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Main</span>}
                  <button onClick={()=>{setEditing(b);setShowForm(true);}} className="rounded-md border border-border p-1 hover:bg-muted"><Pencil size={13}/></button>
                </div>
              </div>
              {b.phone && <p className="text-sm text-muted-foreground mb-3">{b.phone}</p>}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users size={13}/>{b._count.users} users</span>
                <span className="flex items-center gap-1"><Warehouse size={13}/>{b._count.warehouses} warehouses</span>
              </div>
            </div>
          ))}
        </div>
      </DataTableShell>
    </>
  );
}
