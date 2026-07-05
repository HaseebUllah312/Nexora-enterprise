'use client';
/**
 * Cash Memo — Quick Point-of-Sale style sale.
 * No customer required. Cash only. Prints receipt immediately.
 * Used for walk-in customers.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Receipt, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ProductSearch } from '@/components/ui/product-search';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface LineItem { productId:string;productName:string;unit:string;quantity:number;unitPrice:number;discount:number; }
interface Branch   { id:string;name:string; }

interface Props { open:boolean; onClose:()=>void; onCreated:()=>void; }
const PKR=(v:number)=>'PKR '+v.toLocaleString('en-PK',{minimumFractionDigits:2});

export function CashMemoForm({ open, onClose, onCreated }: Props) {
  const user = getCurrentUser();
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [company,  setCompany]    = useState<any>(null);
  const [branchId, setBranchId]   = useState(user?.branch?.id??'');
  const [customerName, setCustomer] = useState('Walk-in Customer');
  const [lines,    setLines]      = useState<LineItem[]>([]);
  const [loading,  setLoading]    = useState(false);
  const [errors,   setErrors]     = useState<Record<string,string>>({});
  const [result,   setResult]     = useState<{invoiceNo:string;total:number}|null>(null);
  const [cashGiven,setCashGiven]  = useState('');
  const [taxRateOverride, setTaxRateOverride] = useState<number | ''>('');

  useEffect(()=>{
    if(!open)return;
    setResult(null);setErrors({});setLines([]);setCashGiven('');setTaxRateOverride('');
    api.get<Branch[]>('/branches').then(setBranches).catch(()=>{});
  },[open]);

  useEffect(()=>{
    if(!branchId)return;
    api.get<any>(`/company-settings?branchId=${branchId}`).then(s => {
      setCompany(s);
      if(s) setTaxRateOverride(s.taxRate);
    }).catch(()=>{});
  },[branchId]);

  function addLine(){ setLines(p=>[...p,{productId:'',productName:'',unit:'',quantity:1,unitPrice:0,discount:0}]); }
  function removeL(i:number){ setLines(p=>p.filter((_,j)=>j!==i)); }
  function setLP(i:number,_:string,p:any){
    if(!p)return;
    setLines(prev=>prev.map((l,j)=>j===i?{...l,productId:p.id,productName:p.name,unit:p.unit,unitPrice:Number(p.salePrice)}:l));
  }
  function upd(i:number,f:keyof LineItem,v:number){ setLines(p=>p.map((l,j)=>j===i?{...l,[f]:v}:l)); }

  const subtotal  = lines.reduce((s,l)=>s+l.quantity*l.unitPrice,0);
  const discount  = lines.reduce((s,l)=>s+l.discount,0);
  const taxRate   = taxRateOverride !== '' ? Number(taxRateOverride) : (company?.taxRate??0);
  const tax       = Math.round((subtotal-discount)*taxRate/100*100)/100;
  const total     = subtotal-discount+tax;
  const change    = cashGiven ? Math.max(0,Number(cashGiven)-total) : 0;

  // We need a default "walk-in" customer — find or use first customer in branch
  async function handleSubmit(){
    if(lines.length===0){setErrors({lines:'Add at least one item'});return;}
    if(lines.some(l=>!l.productId)){setErrors({lines:'Select all products'});return;}
    if(!branchId){setErrors({branchId:'Select a branch'});return;}
    setLoading(true);
    try{
      // Find or create a walk-in customer
      const customers = await api.get<any[]>(`/customers?search=Walk-in&branchId=${branchId}`);
      let walkInId = customers[0]?.id;
      if(!walkInId){
        const wc = await api.post<any>('/customers',{name:'Walk-in Customer',branchId,creditLimit:0});
        walkInId = wc.id;
      }
      // Create order
      const order = await api.post<any>('/sales/orders',{
        customerId:walkInId, branchId,
        items: lines.map(l=>({productId:l.productId,quantity:l.quantity,unitPrice:l.unitPrice,discount:l.discount})),
      });
      await api.patch(`/sales/orders/${order.id}/confirm`);
      const inv = await api.post<any>('/sales/invoices',{
        salesOrderId:order.id,
        paymentMethod:'CASH',
        taxRate: taxRateOverride !== '' ? Number(taxRateOverride) : undefined
      });
      setResult({invoiceNo:inv.invoiceNo,total});
      onCreated();
      // Auto-print
      setTimeout(()=>printMemo(inv.invoiceNo),500);
    }catch(err:any){ setErrors({submit:err.message}); }
    finally{ setLoading(false); }
  }

  function printMemo(invoiceNo:string){
    const comp = company??{companyName:branches.find(b=>b.id===branchId)?.name??'FactoryERP'};
    const rows = lines.map((l,i)=>`
      <tr><td style="padding:4px 0">${i+1}. ${l.productName}</td>
          <td style="padding:4px 0;text-align:center">${l.quantity} ${l.unit}</td>
          <td style="padding:4px 0;text-align:right">${PKR(l.unitPrice)}</td>
          <td style="padding:4px 0;text-align:right;font-weight:bold">${PKR(l.quantity*l.unitPrice-l.discount)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>${invoiceNo}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:5mm}
      h1{font-size:16px;text-align:center;margin-bottom:2px}
      p.center{text-align:center}
      .line{border-top:1px dashed #000;margin:6px 0}
      table{width:100%}
      @page{size:80mm auto;margin:0}</style></head><body>
      <h1>${comp.companyName}</h1>
      ${comp.address?`<p class="center" style="font-size:10px">${comp.address}${comp.city?', '+comp.city:''}</p>`:''}
      ${comp.phone?`<p class="center" style="font-size:10px">Tel: ${comp.phone}</p>`:''}
      ${comp.ntn?`<p class="center" style="font-size:10px">NTN: ${comp.ntn}</p>`:''}
      <div class="line"></div>
      <p class="center" style="font-size:14px;font-weight:bold">CASH MEMO</p>
      <p>${invoiceNo}</p>
      <p>Date: ${new Date().toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
      <p>Customer: ${customerName}</p>
      <div class="line"></div>
      <table>
        <thead><tr>
          <th style="text-align:left">Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Amt</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="line"></div>
      <table>
        ${discount>0?`<tr><td>Discount</td><td style="text-align:right">- ${PKR(discount)}</td></tr>`:''}
        ${tax>0?`<tr><td>GST (${taxRate}%)</td><td style="text-align:right">${PKR(tax)}</td></tr>`:''}
        <tr style="font-size:15px;font-weight:bold"><td>TOTAL</td><td style="text-align:right">${PKR(total)}</td></tr>
        ${cashGiven&&Number(cashGiven)>0?`<tr><td>Cash Given</td><td style="text-align:right">${PKR(Number(cashGiven))}</td></tr>`:''}
        ${change>0?`<tr style="font-weight:bold"><td>Change</td><td style="text-align:right">${PKR(change)}</td></tr>`:''}
      </table>
      <div class="line"></div>
      <p class="center" style="font-size:10px">${comp.termsAndConditions??'Thank you for your business!'}</p>
      <p class="center" style="font-size:9px;margin-top:4px">Nexure Enterprise · Developed by HM Nexora</p>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, `Cash Memo — ${invoiceNo}`);
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w)return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();window.close();}<\/script></body></html>'));
    w.document.close();
  }

  return(
    <Modal open={open} onClose={onClose} title="Quick Cash Memo" subtitle="Fast sale for walk-in customers — prints receipt immediately" width="max-w-3xl">
      {result?(
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Receipt size={28} className="text-emerald-600"/>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">{result.invoiceNo}</p>
            <p className="text-sm text-muted-foreground mt-1">Receipt printed automatically</p>
            <p className="text-lg font-bold mt-2">{PKR(result.total)}</p>
            {change>0&&<p className="text-emerald-600 font-medium">Change: {PKR(change)}</p>}
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button onClick={()=>printMemo(result.invoiceNo)}
              className="flex-1 flex items-center justify-center gap-2 rounded-md border border-border py-2 text-sm hover:bg-muted">
              <Printer size={15}/>Reprint
            </button>
            <button onClick={()=>{setResult(null);setLines([]);setCashGiven('');setCustomer('Walk-in Customer');}}
              className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted">New Memo</button>
            <button onClick={onClose}
              className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Done</button>
          </div>
        </div>
      ):(
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Branch" required error={errors.branchId}>
              <Select value={branchId} onChange={e=>setBranchId(e.target.value)} error={!!errors.branchId}>
                <option value="">Select branch...</option>
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Customer Name">
              <Input value={customerName} onChange={e=>setCustomer(e.target.value)} placeholder="Walk-in Customer"/>
            </Field>
            <Field label="Cash Given (PKR)" hint="For change calculation">
              <Input type="number" min={0} value={cashGiven} onChange={e=>setCashGiven(e.target.value)} placeholder="0"/>
            </Field>
            <Field label="Tax Rate (%)" hint="Overrides default settings">
              <Input type="number" min={0} max={100} step={0.5} value={taxRateOverride}
                onChange={e=>{
                  const v = e.target.value === '' ? '' : Number(e.target.value);
                  setTaxRateOverride(v);
                }}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Items</h3>
              <button onClick={addLine} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Plus size={14}/>Add Item
              </button>
            </div>
            {errors.lines&&<p className="text-xs text-red-500 mb-2">{errors.lines}</p>}
            {lines.length===0?(
              <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Click "Add Item" to start adding products
              </div>
            ):(
              <div className="rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 text-left w-[35%]">Product</th>
                    <th className="px-3 py-2 text-left w-[8%]">Unit</th>
                    <th className="px-3 py-2 text-left w-[13%]">Qty</th>
                    <th className="px-3 py-2 text-left w-[17%]">Price</th>
                    <th className="px-3 py-2 text-left w-[13%]">Discount</th>
                    <th className="px-3 py-2 text-right w-[12%]">Total</th>
                    <th className="px-3 py-2 w-[2%]"></th>
                  </tr></thead>
                  <tbody>
                    {lines.map((line,i)=>{
                      const lt=line.quantity*line.unitPrice-line.discount;
                      return(
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <ProductSearch value={line.productId} onChange={(id,p)=>setLP(i,id,p)} placeholder="Search..."/>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{line.unit||'—'}</td>
                          <td className="px-3 py-2"><Input type="number" min={1} value={line.quantity} onChange={e=>upd(i,'quantity',Number(e.target.value))}/></td>
                          <td className="px-3 py-2"><Input type="number" min={0} value={line.unitPrice} onChange={e=>upd(i,'unitPrice',Number(e.target.value))}/></td>
                          <td className="px-3 py-2"><Input type="number" min={0} value={line.discount} onChange={e=>upd(i,'discount',Number(e.target.value))}/></td>
                          <td className="px-3 py-2 text-right font-semibold">{PKR(lt)}</td>
                          <td className="px-3 py-2"><button onClick={()=>removeL(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {lines.length>0&&(
            <div className="flex justify-end">
              <div className="w-72 rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{PKR(subtotal)}</span></div>
                {discount>0&&<div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-500">- {PKR(discount)}</span></div>}
                {taxRate>0&&<div className="flex justify-between"><span className="text-muted-foreground">GST ({taxRate}%)</span><span>{PKR(tax)}</span></div>}
                <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span className="text-primary">{PKR(total)}</span></div>
                {cashGiven&&Number(cashGiven)>0&&(
                  <div className={`flex justify-between font-semibold ${change>=0?'text-emerald-600':'text-red-500'}`}>
                    <span>Change</span><span>{change>=0?PKR(change):'Insufficient cash'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={loading} label={`Print Receipt — ${PKR(total)}`} loadingLabel="Processing..." onClick={handleSubmit} type="button"/>
          </div>
        </div>
      )}
    </Modal>
  );
}
