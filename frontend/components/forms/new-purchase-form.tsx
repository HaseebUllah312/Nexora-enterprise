'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ProductSearch } from '@/components/ui/product-search';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Supplier  { id:string; name:string; }
interface Branch    { id:string; name:string; }
interface Warehouse { id:string; name:string; branchId:string; }
interface LineItem  { productId:string; productName:string; unit:string; quantity:number; unitCost:number; }

interface Props { open:boolean; onClose:()=>void; onCreated:()=>void; }
const PKR = (v:number) => 'PKR '+v.toLocaleString('en-PK',{maximumFractionDigits:0});

export function NewPurchaseForm({ open, onClose, onCreated }: Props) {
  const currentUser = getCurrentUser();
  const [suppliers,    setSuppliers]    = useState<Supplier[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([]);
  const [supplierId,   setSupplierId]   = useState('');
  const [branchId,     setBranchId]     = useState(currentUser?.branch?.id ?? '');
  const [warehouseId,  setWarehouseId]  = useState('');
  const [lines,        setLines]        = useState<LineItem[]>([]);
  const [quickReceive, setQuickReceive] = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState<Record<string,string>>({});
  const [success,      setSuccess]      = useState<{orderNo:string;total:number;received:boolean}|null>(null);

  useEffect(() => {
    if (!open) return;
    setSuccess(null); setErrors({}); setLines([]);
    Promise.all([
      api.get<Supplier[]>('/suppliers'),
      api.get<Branch[]>('/branches'),
      api.get<Warehouse[]>('/warehouses'),
    ]).then(([s,b,w])=>{ setSuppliers(s); setBranches(b); setWarehouses(w); });
  }, [open]);

  const filteredWH = warehouses.filter(w=>w.branchId===branchId);

  function addLine(){ setLines(p=>[...p,{productId:'',productName:'',unit:'',quantity:1,unitCost:0}]); }
  function removeL(i:number){ setLines(p=>p.filter((_,j)=>j!==i)); }
  function setLP(i:number, productId:string, product:any){
    if(!product) return;
    setLines(p=>p.map((l,j)=>j===i?{...l,productId:product.id,productName:product.name,unit:product.unit,unitCost:Number(product.purchasePrice)}:l));
  }
  function upd(i:number, f:keyof LineItem, v:number|string){
    setLines(p=>p.map((l,j)=>j===i?{...l,[f]:v}:l));
  }

  const total = lines.reduce((s,l)=>s+l.quantity*l.unitCost,0);

  function validate(){
    const e:Record<string,string>={};
    if(!supplierId) e.supplierId='Select supplier';
    if(!branchId)   e.branchId='Select branch';
    if(quickReceive&&!warehouseId) e.warehouseId='Select receiving warehouse';
    if(lines.length===0) e.lines='Add at least one product';
    lines.forEach((l,i)=>{
      if(!l.productId)     e[`l_${i}_p`]='Select product';
      if(l.quantity<=0)    e[`l_${i}_q`]='Qty > 0';
      if(l.unitCost<=0)    e[`l_${i}_c`]='Cost > 0';
    });
    setErrors(e); return Object.keys(e).length===0;
  }

  async function handleSubmit(){
    if(!validate()) return;
    setLoading(true);
    try{
      const order = await api.post<{id:string;orderNo:string}>('/purchases/orders',{
        supplierId, branchId,
        items: lines.map(l=>({productId:l.productId,quantity:l.quantity,unitCost:l.unitCost})),
      });
      await api.patch(`/purchases/orders/${order.id}/approve`);
      if(quickReceive){
        await api.post('/purchases/grn',{purchaseOrderId:order.id,warehouseId});
      }
      await api.post('/purchases/invoices',{purchaseOrderId:order.id});
      setSuccess({orderNo:order.orderNo,total,received:quickReceive});
      onCreated();
    }catch(err:any){ setErrors({submit:err.message}); }
    finally{ setLoading(false); }
  }

  if(success){
    return(
      <Modal open={open} onClose={onClose} title="Purchase Recorded" width="max-w-md">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"><Package size={28} className="text-blue-600"/></div>
          <div><p className="text-2xl font-bold text-blue-600">{success.orderNo}</p><p className="text-sm text-muted-foreground mt-1">Purchase order created</p></div>
          <div className="w-full rounded-lg bg-muted p-4 text-sm space-y-1.5">
            <div className="flex justify-between"><span>Total Amount</span><span className="font-semibold">{PKR(success.total)}</span></div>
            <div className="flex justify-between"><span>Stock</span>
              <span className={success.received?'text-emerald-600 font-medium':'text-amber-600'}>
                {success.received?'✓ Added to warehouse':'Pending GRN'}
              </span>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={()=>{setSuccess(null);setLines([]);setSupplierId('');}} className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted">New Purchase</button>
            <button onClick={onClose} className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  return(
    <Modal open={open} onClose={onClose} title="New Purchase Order" subtitle="Record goods received from supplier — stock added automatically" width="max-w-4xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Supplier" required error={errors.supplierId}>
            <Select value={supplierId} onChange={e=>setSupplierId(e.target.value)} error={!!errors.supplierId}>
              <option value="">Select supplier...</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Branch" required error={errors.branchId}>
            <Select value={branchId} onChange={e=>{setBranchId(e.target.value);setWarehouseId('');}} error={!!errors.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Receive Into Warehouse" required={quickReceive} error={errors.warehouseId}>
            <Select value={warehouseId} onChange={e=>setWarehouseId(e.target.value)} disabled={!quickReceive} error={!!errors.warehouseId}>
              <option value="">Select warehouse...</option>
              {filteredWH.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
        </div>

        {/* Quick receive toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-lg border border-border bg-muted/20 px-4 py-3">
          <div onClick={()=>setQuickReceive(v=>!v)} className={`relative h-6 w-11 rounded-full transition-colors ${quickReceive?'bg-primary':'bg-muted-foreground/30'}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${quickReceive?'translate-x-6':'translate-x-1'}`}/>
          </div>
          <div>
            <p className="text-sm font-medium">Quick Receive — add stock immediately on save</p>
            <p className="text-xs text-muted-foreground">Disable only if you need GRN approval before stock is added</p>
          </div>
        </label>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Items</h3>
            <button onClick={addLine} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"><Plus size={14}/>Add Item</button>
          </div>
          {errors.lines && <p className="text-xs text-red-500 mb-2">{errors.lines}</p>}
          {lines.length===0?(
            <div className="rounded-lg border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">Click "Add Item" to add products</div>
          ):(
            <div className="rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 w-[40%]">Product</th>
                  <th className="px-3 py-2 w-[10%]">Unit</th>
                  <th className="px-3 py-2 w-[15%]">Quantity</th>
                  <th className="px-3 py-2 w-[20%]">Cost Price (PKR)</th>
                  <th className="px-3 py-2 w-[12%] text-right">Line Total</th>
                  <th className="px-3 py-2 w-[3%]"></th>
                </tr></thead>
                <tbody>
                  {lines.map((line,i)=>(
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <ProductSearch value={line.productId} onChange={(id,p)=>setLP(i,id,p)} error={!!errors[`l_${i}_p`]} placeholder="Search product..."/>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{line.unit||'—'}</td>
                      <td className="px-3 py-2">
                        <Input type="number" min={1} value={line.quantity} onChange={e=>upd(i,'quantity',Number(e.target.value))} error={!!errors[`l_${i}_q`]}/>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={line.unitCost} onChange={e=>upd(i,'unitCost',Number(e.target.value))} error={!!errors[`l_${i}_c`]}/>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{PKR(line.quantity*line.unitCost)}</td>
                      <td className="px-3 py-2">
                        <button onClick={()=>removeL(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {lines.length>0&&(
          <div className="flex justify-end">
            <div className="w-56 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{PKR(total)}</span></div>
            </div>
          </div>
        )}

        {errors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={`Save PO — ${PKR(total)}`} onClick={handleSubmit} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
