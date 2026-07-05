'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Tag, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

interface Cat { id:string;name:string;parentId?:string;parent?:{name:string}|null;_count:{products:number;children:number}; }

export default function CategoriesPage() {
  const [cats,setCats]=useState<Cat[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Cat|null>(null);
  const [form,setForm]=useState({name:'',parentId:''});
  const [fErr,setFErr]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{setCats(await api.get<Cat[]>('/categories'));}
    catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  function open(c?:Cat){setEditing(c??null);setForm(c?{name:c.name,parentId:c.parentId??''}:{name:'',parentId:''});setFErr({});setShowForm(true);}

  async function save(){
    if(!form.name.trim()){setFErr({name:'Required'});return;}
    setSaving(true);
    try{
      if(editing) await api.patch(`/categories/${editing.id}`,{name:form.name,parentId:form.parentId||undefined});
      else await api.post('/categories',{name:form.name,parentId:form.parentId||undefined});
      setShowForm(false);load();
    }catch(err:any){setFErr({submit:err.message});}
    finally{setSaving(false);}
  }

  return(
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?'Edit Category':'Add Category'} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <Field label="Category Name" required error={fErr.name}>
            <Input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="PVC Pipes" error={!!fErr.name}/>
          </Field>
          <Field label="Parent Category" hint="Leave blank for top-level">
            <Select value={form.parentId} onChange={e=>setForm(p=>({...p,parentId:e.target.value}))}>
              <option value="">Top Level</option>
              {cats.filter(c=>!editing||c.id!==editing.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {fErr.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label={editing?'Save':'Add Category'} onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell title="Product Categories" description="Organise products into categories and sub-categories"
        loading={loading} error={error} empty={cats.length===0} emptyLabel="No categories yet."
        action={<button onClick={()=>open()} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"><Plus size={16}/>Add Category</button>}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Name','Parent','Products','Sub-categories',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>{cats.map(c=>(
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-medium flex items-center gap-2"><Tag size={13} className="text-primary"/>{c.name}</td>
              <td className="px-4 py-3">{c.parent?.name??<span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3">{c._count.products}</td>
              <td className="px-4 py-3">{c._count.children}</td>
              <td className="px-4 py-3"><button onClick={()=>open(c)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><Pencil size={11}/>Edit</button></td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}
