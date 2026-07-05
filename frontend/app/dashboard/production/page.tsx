'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Play, CheckCircle, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { BomForm } from '@/components/forms/bom-form';

interface ProductionOrder { id:string;orderNo:string;status:string;quantityPlanned:string;quantityProduced:string;wastage:string;createdAt:string;bom:{name:string;finishedProduct:{name:string}};branch:{name:string}; }
interface Bom { id:string;name:string;finishedProduct:{name:string};components:{product:{name:string};quantity:string}[]; }
interface Branch { id:string;name:string; }

const S:Record<string,string>={PLANNED:'bg-gray-100 text-gray-600',IN_PROGRESS:'bg-blue-100 text-blue-700',COMPLETED:'bg-emerald-100 text-emerald-700',CANCELLED:'bg-red-100 text-red-700'};

export default function ProductionPage() {
  const [orders,setOrders]=useState<ProductionOrder[]>([]);
  const [boms,setBoms]=useState<Bom[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [tab,setTab]=useState<'orders'|'bom'>('orders');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [showNewOrder,setShowNewOrder]=useState(false);
  const [showBomForm,setShowBomForm]=useState(false);
  const [newForm,setNewForm]=useState({bomId:'',branchId:'',quantityPlanned:''});
  const [newErrors,setNewErrors]=useState<Record<string,string>>({});
  const [newLoading,setNewLoading]=useState(false);
  const [completing,setCompleting]=useState<ProductionOrder|null>(null);
  const [produced,setProduced]=useState('');
  const [wastage,setWastage]=useState('0');
  const [completeLoading,setCompleteLoading]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const[o,b,br]=await Promise.all([
        api.get<ProductionOrder[]>('/manufacturing/orders'),
        api.get<Bom[]>('/manufacturing/bom'),
        api.get<Branch[]>('/branches'),
      ]);
      setOrders(o);setBoms(b);setBranches(br);
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  async function startOrder(id:string){
    try{await api.patch(`/manufacturing/orders/${id}/start`);load();}catch(e:any){alert(e.message);}
  }

  async function completeOrder(){
    if(!completing||!produced||Number(produced)<=0)return;
    setCompleteLoading(true);
    try{
      await api.patch(`/manufacturing/orders/${completing.id}/complete?quantityProduced=${produced}&wastage=${wastage||0}`);
      setCompleting(null);setProduced('');setWastage('0');load();
    }catch(e:any){alert(e.message);}finally{setCompleteLoading(false);}
  }

  async function createOrder(){
    const e:Record<string,string>={};
    if(!newForm.bomId)                                        e.bomId='Select a BOM';
    if(!newForm.branchId)                                     e.branchId='Select branch';
    if(!newForm.quantityPlanned||Number(newForm.quantityPlanned)<=0) e.qty='Enter quantity';
    setNewErrors(e);if(Object.keys(e).length)return;
    setNewLoading(true);
    try{
      await api.post('/manufacturing/orders',{bomId:newForm.bomId,branchId:newForm.branchId,quantityPlanned:Number(newForm.quantityPlanned)});
      setShowNewOrder(false);setNewForm({bomId:'',branchId:'',quantityPlanned:''});load();
    }catch(err:any){setNewErrors({submit:err.message});}
    finally{setNewLoading(false);}
  }

  return(
    <>
      <BomForm open={showBomForm} onClose={()=>setShowBomForm(false)} onSaved={load}/>

      {/* New Order Modal */}
      <Modal open={showNewOrder} onClose={()=>setShowNewOrder(false)} title="New Production Order" width="max-w-md">
        <div className="flex flex-col gap-4">
          <Field label="Bill of Materials" required error={newErrors.bomId}>
            <Select value={newForm.bomId} onChange={e=>setNewForm(p=>({...p,bomId:e.target.value}))} error={!!newErrors.bomId}>
              <option value="">Select BOM...</option>
              {boms.map(b=><option key={b.id} value={b.id}>{b.name} → {b.finishedProduct.name}</option>)}
            </Select>
          </Field>
          {newForm.bomId&&(
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1 text-muted-foreground text-xs uppercase tracking-wide">Raw materials required per unit:</p>
              {boms.find(b=>b.id===newForm.bomId)?.components.map((c,i)=>(
                <p key={i} className="text-xs py-0.5">· {c.product.name} × {c.quantity}</p>
              ))}
            </div>
          )}
          <Field label="Branch" required error={newErrors.branchId}>
            <Select value={newForm.branchId} onChange={e=>setNewForm(p=>({...p,branchId:e.target.value}))} error={!!newErrors.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Planned Quantity" required error={newErrors.qty}>
            <Input type="number" min={1} value={newForm.quantityPlanned} onChange={e=>setNewForm(p=>({...p,quantityPlanned:e.target.value}))} placeholder="500" error={!!newErrors.qty}/>
          </Field>
          {newErrors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{newErrors.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowNewOrder(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={newLoading} label="Create Order" onClick={createOrder} type="button"/>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal open={!!completing} onClose={()=>setCompleting(null)} title={`Complete — ${completing?.orderNo}`} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium">{completing?.bom.finishedProduct.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Planned</span><span className="font-medium">{completing?.quantityPlanned} units</span></div>
          </div>
          <Field label="Quantity Actually Produced" required hint="Units that passed quality check">
            <Input type="number" min={0} value={produced} onChange={e=>setProduced(e.target.value)} placeholder={completing?.quantityPlanned}/>
          </Field>
          <Field label="Wastage / Defects" hint="Units lost or rejected">
            <Input type="number" min={0} value={wastage} onChange={e=>setWastage(e.target.value)} placeholder="0"/>
          </Field>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setCompleting(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={completeLoading} label="Mark Completed" onClick={completeOrder} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell title="Manufacturing" description="Bill of Materials and production orders"
        loading={loading} error={error}
        empty={tab==='orders'?orders.length===0:boms.length===0}
        emptyLabel={tab==='orders'?'No production orders yet.':'No BOMs yet — create one first.'}
        action={
          <div className="flex gap-2">
            <button onClick={()=>setShowBomForm(true)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium">
              <Layers size={15}/>New BOM
            </button>
            <button onClick={()=>setShowNewOrder(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
              <Plus size={16}/>New Order
            </button>
          </div>
        }>
        <div className="flex gap-1 border-b border-border p-2">
          {(['orders','bom'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab===t?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted'}`}>
              {t==='bom'?'Bill of Materials':'Production Orders'}
            </button>
          ))}
        </div>

        {tab==='orders'?(
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Order #','Product','Branch','Planned','Produced','Wastage','Status','Actions'].map(h=>(
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody>{orders.map(o=>(
              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{o.orderNo}</td>
                <td className="px-4 py-3 font-medium">{o.bom.finishedProduct.name}</td>
                <td className="px-4 py-3">{o.branch.name}</td>
                <td className="px-4 py-3">{Number(o.quantityPlanned).toLocaleString()}</td>
                <td className="px-4 py-3 text-emerald-600 font-medium">{Number(o.quantityProduced).toLocaleString()}</td>
                <td className="px-4 py-3 text-amber-600">{Number(o.wastage).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${S[o.status]||''}`}>{o.status.replace('_',' ')}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {o.status==='PLANNED'&&<button onClick={()=>startOrder(o.id)} className="flex items-center gap-1 rounded border border-blue-300 text-blue-700 px-2 py-0.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20"><Play size={11}/>Start</button>}
                    {o.status==='IN_PROGRESS'&&<button onClick={()=>{setCompleting(o);setProduced(o.quantityPlanned);}} className="flex items-center gap-1 rounded border border-emerald-300 text-emerald-700 px-2 py-0.5 text-xs hover:bg-emerald-50"><CheckCircle size={11}/>Complete</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        ):(
          <div className="divide-y divide-border">
            {boms.map(b=>(
              <div key={b.id} className="px-5 py-4 hover:bg-muted/40">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={15} className="text-primary"/>
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-xs text-muted-foreground">→ {b.finishedProduct.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.components.map((c,i)=>(
                    <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.product.name} × {c.quantity}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataTableShell>
    </>
  );
}
