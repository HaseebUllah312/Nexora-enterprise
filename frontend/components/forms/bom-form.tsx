'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Product { id:string;name:string;sku:string;unit:string;isRawMaterial:boolean; }
interface Props { open:boolean;onClose:()=>void;onSaved:()=>void; }

export function BomForm({ open, onClose, onSaved }: Props) {
  const [products,setProducts]=useState<Product[]>([]);
  const [finished,setFinished]=useState<Product[]>([]);
  const [rawMats,setRawMats]=useState<Product[]>([]);
  const [name,setName]=useState('');
  const [finishedId,setFinishedId]=useState('');
  const [components,setComponents]=useState<{productId:string;quantity:string}[]>([]);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!open) return;
    setName('');setFinishedId('');setComponents([]);setErrors({});
    api.get<Product[]>('/products').then(p=>{
      setProducts(p);
      setFinished(p.filter(x=>!x.isRawMaterial));
      setRawMats(p.filter(x=>x.isRawMaterial));
    }).catch(()=>{});
  },[open]);

  function addComp(){ setComponents(c=>[...c,{productId:'',quantity:'1'}]); }
  function removeComp(i:number){ setComponents(c=>c.filter((_,j)=>j!==i)); }
  function setComp(i:number,f:'productId'|'quantity',v:string){
    setComponents(c=>c.map((x,j)=>j===i?{...x,[f]:v}:x));
  }

  function validate(){
    const e:Record<string,string>={};
    if(!name.trim())    e.name='BOM name required';
    if(!finishedId)     e.finishedId='Select finished product';
    if(components.length===0) e.components='Add at least one raw material';
    components.forEach((c,i)=>{
      if(!c.productId)           e[`c_${i}_p`]='Select material';
      if(!c.quantity||Number(c.quantity)<=0) e[`c_${i}_q`]='Qty > 0';
    });
    setErrors(e);return Object.keys(e).length===0;
  }

  async function save(){
    if(!validate())return;
    setLoading(true);
    try{
      await api.post('/manufacturing/bom',{
        name,finishedProductId:finishedId,
        components:components.map(c=>({productId:c.productId,quantity:Number(c.quantity)})),
      });
      onSaved();onClose();
    }catch(err:any){setErrors({submit:err.message});}
    finally{setLoading(false);}
  }

  return(
    <Modal open={open} onClose={onClose} title="Create Bill of Materials" subtitle="Define what raw materials are needed to produce one unit of a finished product" width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="BOM Name" required error={errors.name}>
            <Input value={name} onChange={e=>setName(e.target.value)} placeholder="PVC 2-Inch Pipe BOM" error={!!errors.name}/>
          </Field>
          <Field label="Finished Product" required error={errors.finishedId}>
            <Select value={finishedId} onChange={e=>setFinishedId(e.target.value)} error={!!errors.finishedId}>
              <option value="">Select finished product...</option>
              {finished.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Raw Materials (per 1 unit)</h3>
            <button onClick={addComp} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              <Plus size={14}/>Add Material
            </button>
          </div>
          {errors.components&&<p className="text-xs text-red-500 mb-2">{errors.components}</p>}
          {components.length===0?(
            <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Add raw materials that go into producing this product
            </div>
          ):(
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 w-[60%]">Raw Material</th>
                  <th className="px-3 py-2 w-[25%]">Qty per Unit</th>
                  <th className="px-3 py-2 w-[15%]"></th>
                </tr></thead>
                <tbody>
                  {components.map((c,i)=>(
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Select value={c.productId} onChange={e=>setComp(i,'productId',e.target.value)} error={!!errors[`c_${i}_p`]}>
                          <option value="">Select raw material...</option>
                          {rawMats.length>0
                            ? rawMats.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)
                            : products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)
                          }
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0.001} step={0.001} value={c.quantity} onChange={e=>setComp(i,'quantity',e.target.value)} error={!!errors[`c_${i}_q`]}/>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={()=>removeComp(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label="Save BOM" onClick={save} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
