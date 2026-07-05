'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Branch  { id:string;name:string; }
interface Product { id:string;name:string;sku:string;unit:string; }
interface Props { open:boolean;onClose:()=>void;onSaved:()=>void; }

export function TransferForm({ open, onClose, onSaved }: Props) {
  const [branches,setBranches]=useState<Branch[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [fromBranchId,setFrom]=useState('');
  const [toBranchId,setTo]=useState('');
  const [items,setItems]=useState<{productId:string;quantity:string}[]>([]);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setFrom('');setTo('');setItems([]);setErrors({});
    Promise.all([api.get<Branch[]>('/branches'),api.get<Product[]>('/products')])
      .then(([b,p])=>{setBranches(b);setProducts(p);}).catch(()=>{});
  },[open]);

  function addItem(){ setItems(i=>[...i,{productId:'',quantity:''}]); }
  function setItem(i:number,f:'productId'|'quantity',v:string){setItems(a=>a.map((x,j)=>j===i?{...x,[f]:v}:x));}

  function validate(){
    const e:Record<string,string>={};
    if(!fromBranchId) e.from='Select source branch';
    if(!toBranchId)   e.to='Select destination branch';
    if(fromBranchId===toBranchId&&fromBranchId) e.to='Must be different from source';
    if(items.length===0) e.items='Add at least one product';
    items.forEach((it,i)=>{
      if(!it.productId) e[`i_${i}_p`]='Select product';
      if(!it.quantity||Number(it.quantity)<=0) e[`i_${i}_q`]='Qty > 0';
    });
    setErrors(e);return Object.keys(e).length===0;
  }

  async function save(){
    if(!validate())return;
    setLoading(true);
    try{
      await api.post('/inventory/transfers',{
        fromBranchId,toBranchId,
        items:items.map(i=>({productId:i.productId,quantity:Number(i.quantity)})),
      });
      onSaved();onClose();
    }catch(err:any){setErrors({submit:err.message});}
    finally{setLoading(false);}
  }

  return(
    <Modal open={open} onClose={onClose} title="New Stock Transfer" subtitle="Request stock to be moved between branches" width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="From Branch" required error={errors.from}>
            <Select value={fromBranchId} onChange={e=>setFrom(e.target.value)} error={!!errors.from}>
              <option value="">Source branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="To Branch" required error={errors.to}>
            <Select value={toBranchId} onChange={e=>setTo(e.target.value)} error={!!errors.to}>
              <option value="">Destination branch...</option>
              {branches.filter(b=>b.id!==fromBranchId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Products to Transfer</h3>
            <button onClick={addItem} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"><Plus size={14}/>Add Product</button>
          </div>
          {errors.items&&<p className="text-xs text-red-500 mb-2">{errors.items}</p>}
          {items.length===0?(
            <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">Add products to transfer</div>
          ):(
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 text-left w-[65%]">Product</th>
                  <th className="px-3 py-2 text-left w-[25%]">Quantity</th>
                  <th className="px-3 py-2 w-[10%]"></th>
                </tr></thead>
                <tbody>{items.map((it,i)=>(
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Select value={it.productId} onChange={e=>setItem(i,'productId',e.target.value)} error={!!errors[`i_${i}_p`]}>
                        <option value="">Select product...</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2"><Input type="number" min={1} value={it.quantity} onChange={e=>setItem(i,'quantity',e.target.value)} error={!!errors[`i_${i}_q`]} placeholder="0"/></td>
                    <td className="px-3 py-2 text-center"><button onClick={()=>setItems(a=>a.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label="Create Transfer Request" onClick={save} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
