'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Warehouse, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

interface WH { id:string;name:string;code:string;isGodown:boolean;branchId:string;branch:{name:string};_count:{stock:number}; }
interface Branch { id:string;name:string; }

export default function WarehousesPage() {
  const [whs,setWhs]=useState<WH[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<WH|null>(null);
  const [form,setForm]=useState({name:'',code:'',branchId:'',isGodown:false});
  const [fErr,setFErr]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const[w,b]=await Promise.all([api.get<WH[]>('/warehouses'),api.get<Branch[]>('/branches')]);setWhs(w);setBranches(b);}
    catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  function open(wh?:WH){
    setEditing(wh??null);
    setForm(wh?{name:wh.name,code:wh.code,branchId:wh.branchId,isGodown:wh.isGodown}:{name:'',code:'',branchId:'',isGodown:false});
    setFErr({});setShowForm(true);
  }
  function set(f:string,v:string|boolean){setForm(p=>({...p,[f]:v}));setFErr(p=>({...p,[f]:''}))}

  async function save(){
    const e:Record<string,string>={};
    if(!form.name.trim()) e.name='Required';
    if(!form.code.trim()) e.code='Required';
    if(!form.branchId)    e.branchId='Select a branch';
    setFErr(e);if(Object.keys(e).length)return;
    setSaving(true);
    try{
      if(editing) await api.patch(`/warehouses/${editing.id}`,form);
      else await api.post('/warehouses',form);
      setShowForm(false);load();
    }catch(err:any){setFErr({submit:err.message});}
    finally{setSaving(false);}
  }

  return(
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?'Edit Warehouse':'Add Warehouse'} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Warehouse Name" required error={fErr.name}>
              <Input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Main Store" error={!!fErr.name}/>
            </Field>
            <Field label="Code" required error={fErr.code} hint="Unique short code">
              <Input value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="WH-01" error={!!fErr.code}/>
            </Field>
          </div>
          <Field label="Branch" required error={fErr.branchId}>
            <Select value={form.branchId} onChange={e=>set('branchId',e.target.value)} error={!!fErr.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={()=>set('isGodown',!form.isGodown)}
              className={`relative h-5 w-9 rounded-full transition-colors ${form.isGodown?'bg-primary':'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isGodown?'translate-x-4':'translate-x-0.5'}`}/>
            </div>
            <span className="text-sm">Godown (external storage)</span>
          </label>
          {fErr.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label={editing?'Save Changes':'Add Warehouse'} onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell title="Warehouses" description="Storage locations per branch — used for stock in/out and transfers"
        loading={loading} error={error} empty={whs.length===0} emptyLabel="No warehouses yet."
        action={<button onClick={()=>open()} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"><Plus size={16}/>Add Warehouse</button>}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Name','Code','Branch','Type','Stock Lines',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>{whs.map(w=>(
            <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-medium flex items-center gap-2"><Warehouse size={14} className="text-muted-foreground"/>{w.name}</td>
              <td className="px-4 py-3 font-mono text-xs">{w.code}</td>
              <td className="px-4 py-3">{w.branch.name}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${w.isGodown?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{w.isGodown?'Godown':'Warehouse'}</span></td>
              <td className="px-4 py-3">{w._count.stock}</td>
              <td className="px-4 py-3"><button onClick={()=>open(w)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><Pencil size={11}/>Edit</button></td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}
