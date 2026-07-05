'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, CreditCard, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

const PKR  = (v:number|string) => 'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const FMT  = (v:number|string) => 'PKR '+Number(v).toLocaleString('en-PK',{minimumFractionDigits:2});

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const [order,   setOrder]   = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [amount,  setAmount]  = useState('');
  const [payErr,  setPayErr]  = useState('');
  const [payLoad, setPayLoad] = useState(false);
  const [payOk,   setPayOk]   = useState(false);

  useEffect(()=>{ load(); },[id]);

  async function load(){
    setLoading(true);
    try{
      const o = await api.get<any>(`/purchases/orders/${id}`);
      setOrder(o);
      const bid = o.branchId ?? o.branch?.id;
      if(bid) api.get<any>(`/company-settings?branchId=${bid}`).then(setCompany).catch(()=>{});
    }catch{}
    finally{ setLoading(false); }
  }

  async function pay(){
    if(!order?.invoice) return;
    const amt = Number(amount);
    const outstanding = Number(order.invoice.totalAmount)-Number(order.invoice.paidAmount);
    if(!amt||amt<=0){ setPayErr('Enter valid amount'); return; }
    if(amt>outstanding){ setPayErr(`Max: ${PKR(outstanding)}`); return; }
    setPayLoad(true); setPayErr('');
    try{
      await api.post('/purchases/invoices/payment',{invoiceId:order.invoice.id,amount:amt});
      setPayOk(true); await load();
      setTimeout(()=>{setShowPay(false);setPayOk(false);setAmount('');},1500);
    }catch(e:any){ setPayErr(e.message); }
    finally{ setPayLoad(false); }
  }

  function printPO(){
    if(!order) return;
    const comp = company ?? { companyName: order.branch?.name };
    const rows = order.items?.map((it:any,i:number)=>`
      <tr style="background:${i%2?'#f8fafc':'#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i+1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${it.product?.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${it.product?.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:bold">${Number(it.quantity).toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${FMT(it.unitCost)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">${FMT(Number(it.quantity)*Number(it.unitCost))}</td>
      </tr>`).join('');
    const total = order.items?.reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unitCost),0)??0;
    const inv = order.invoice;
    const html = `<!DOCTYPE html><html><head><title>${inv?.invoiceNo??order.orderNo}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px}@page{size:A4;margin:12mm}table{width:100%;border-collapse:collapse}</style></head>
      <body>
      <div style="background:#1e293b;color:white;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="font-size:20px;font-weight:bold;margin-bottom:4px">${comp.companyName}</h1>
          ${comp.address?`<p style="font-size:11px;opacity:0.75">${comp.address}${comp.city?', '+comp.city:''}</p>`:''}
          ${comp.phone?`<p style="font-size:11px;opacity:0.75">Tel: ${comp.phone}</p>`:''}
          ${comp.ntn?`<p style="font-size:11px;opacity:0.75">NTN: ${comp.ntn}</p>`:''}
        </div>
        <div style="text-align:right">
          <h2 style="font-size:24px;font-weight:bold;letter-spacing:2px;opacity:0.9">PURCHASE ORDER</h2>
          <p style="font-size:15px;font-weight:bold;margin-top:4px">${inv?.invoiceNo??order.orderNo}</p>
          <p style="font-size:11px;opacity:0.75">Date: ${new Date(order.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:16px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
        <div>
          <p style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px">Supplier</p>
          <p style="font-size:15px;font-weight:bold">${order.supplier?.name}</p>
          ${order.supplier?.phone?`<p style="color:#555;margin-top:2px">${order.supplier.phone}</p>`:''}
          ${order.supplier?.address?`<p style="color:#555;margin-top:2px">${order.supplier.address}</p>`:''}
        </div>
        <div style="text-align:right">
          <p style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px">Branch</p>
          <p style="font-weight:bold">${order.branch?.name}</p>
          <p style="color:#555;margin-top:2px">Status: ${order.status}</p>
        </div>
      </div>
      <div style="padding:20px 24px 0">
        <table><thead><tr style="background:#1d4ed8;color:white">
          <th style="padding:10px 12px;text-align:left;width:4%">#</th>
          <th style="padding:10px 12px;text-align:left;width:40%">Product</th>
          <th style="padding:10px 12px;text-align:center;width:10%">Unit</th>
          <th style="padding:10px 12px;text-align:center;width:12%">Qty</th>
          <th style="padding:10px 12px;text-align:right;width:17%">Unit Cost</th>
          <th style="padding:10px 12px;text-align:right;width:17%">Total</th>
        </tr></thead><tbody>${rows}</tbody>
        <tfoot><tr style="background:#1e293b;color:white">
          <td colspan="5" style="padding:12px;font-size:14px;font-weight:bold">Grand Total</td>
          <td style="padding:12px;text-align:right;font-size:14px;font-weight:bold">${FMT(inv?.totalAmount??total)}</td>
        </tr>
        ${inv&&Number(inv.paidAmount)>0?`<tr style="background:#166534;color:white"><td colspan="5" style="padding:8px 12px">Paid</td><td style="padding:8px 12px;text-align:right">${FMT(inv.paidAmount)}</td></tr>`:''}
        ${inv&&(Number(inv.totalAmount)-Number(inv.paidAmount))>0?`<tr style="background:#991b1b;color:white"><td colspan="5" style="padding:8px 12px;font-weight:bold">Balance Due</td><td style="padding:8px 12px;text-align:right;font-weight:bold">${FMT(Number(inv.totalAmount)-Number(inv.paidAmount))}</td></tr>`:''}
        </tfoot></table>
      </div>
      ${comp.termsAndConditions?`<div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;margin-top:20px"><p style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px">Terms</p><p style="color:#555">${comp.termsAndConditions}</p></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:24px;margin-top:16px">
        <div style="text-align:center;width:180px"><div style="border-top:1px solid #374151;padding-top:6px;color:#6b7280;font-size:11px">Authorized by</div></div>
        <div style="text-align:center;width:180px"><div style="border-top:1px solid #374151;padding-top:6px;color:#6b7280;font-size:11px">Supplier Signature</div></div>
      </div>
      <div style="text-align:center;padding:8px;background:#1e293b;color:rgba(255,255,255,0.5);font-size:10px">Generated by Nexora Enterprise · ${comp.companyName}</div>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, `Purchase Order — ${inv?.invoiceNo??order.orderNo}`);
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();window.close();}<\/script></body></html>'));
    w.document.close();
  }

  if(loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin"/>Loading...</div>;
  if(!order) return <div className="text-red-500">Purchase order not found.</div>;

  const inv = order.invoice;
  const total = order.items?.reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unitCost),0)??0;
  const outstanding = inv ? Number(inv.totalAmount)-Number(inv.paidAmount) : 0;
  const paid = outstanding<=0&&!!inv;

  return(
    <>
      <Modal open={showPay} onClose={()=>{setShowPay(false);setPayErr('');setAmount('');}}
        title="Pay Supplier" subtitle={`Outstanding: ${PKR(outstanding)}`} width="max-w-sm">
        <div className="flex flex-col gap-4">
          {payOk?(
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={40} className="text-emerald-500"/>
              <p className="font-bold text-emerald-600">Payment Recorded!</p>
            </div>
          ):(
            <>
              <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span>Invoice Total</span><span className="font-semibold">{FMT(inv?.totalAmount??0)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span className="text-emerald-600 font-semibold">{FMT(inv?.paidAmount??0)}</span></div>
                <div className="flex justify-between border-t pt-1.5 font-bold"><span>Outstanding</span><span className="text-red-500">{FMT(outstanding)}</span></div>
              </div>
              <Field label="Payment Amount (PKR)" required error={payErr}>
                <Input type="number" min={1} max={outstanding} value={amount}
                  onChange={e=>{setAmount(e.target.value);setPayErr('');}} placeholder={outstanding.toString()}/>
              </Field>
              <button onClick={()=>setAmount(outstanding.toString())} className="rounded-md border border-border py-2 text-sm hover:bg-muted">
                Pay Full Amount — {PKR(outstanding)}
              </button>
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button onClick={()=>setShowPay(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
                <SubmitButton loading={payLoad} label="Save Payment" onClick={pay} type="button"/>
              </div>
            </>
          )}
        </div>
      </Modal>

      <div className="flex flex-col gap-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.back()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><ArrowLeft size={14}/>Back</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{inv?.invoiceNo??order.orderNo}</h1>
            <p className="text-sm text-muted-foreground">{order.supplier?.name} · {order.branch?.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={printPO} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium"><Printer size={15}/>Print PO</button>
            {inv&&!paid&&<button onClick={()=>setShowPay(true)} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><CreditCard size={15}/>Pay Supplier</button>}
            <button onClick={()=>router.push('/dashboard/returns')} className="flex items-center gap-2 rounded-md border border-red-300 text-red-600 px-3 py-2 text-sm hover:bg-red-50"><RotateCcw size={15}/>Return</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Payment Summary</h3>
            {inv?(
              <div className="text-sm space-y-2">
                {[['Invoice',inv.invoiceNo],['Date',new Date(inv.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})]].map(([k,v])=>(
                  <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                ))}
                <div className="border-t pt-2 space-y-1.5">
                  <div className="flex justify-between"><span>Total</span><span className="font-bold">{FMT(inv.totalAmount)}</span></div>
                  <div className="flex justify-between"><span>Paid</span><span className="text-emerald-600 font-semibold">{FMT(inv.paidAmount)}</span></div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span>Outstanding</span>
                    <span className={paid?'text-emerald-600':'text-red-500'}>{paid?'✓ Fully Paid':FMT(outstanding)}</span>
                  </div>
                </div>
              </div>
            ):<p className="text-sm text-muted-foreground">Status: {order.status}</p>}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Supplier</h3>
            <p className="font-bold text-base">{order.supplier?.name}</p>
            {order.supplier?.phone   && <p className="text-sm text-muted-foreground mt-1">{order.supplier.phone}</p>}
            {order.supplier?.address && <p className="text-sm text-muted-foreground">{order.supplier.address}</p>}
            {order.supplier?.taxNumber && <p className="text-xs text-muted-foreground mt-1">NTN: {order.supplier.taxNumber}</p>}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Order Status</h3>
            {['REQUISITION','ORDERED','RECEIVED','INVOICED'].map((s,i)=>{
              const stages=['REQUISITION','ORDERED','RECEIVED','INVOICED'];
              const done=stages.indexOf(order.status)>=i;
              return(
                <div key={s} className={`flex items-center gap-2 text-sm py-0.5 ${done?'text-foreground':'text-muted-foreground'}`}>
                  <div className={`h-2 w-2 rounded-full ${done?'bg-primary':'bg-muted'}`}/>
                  {s.charAt(0)+s.slice(1).toLowerCase()}
                  {order.status===s&&<span className="ml-auto text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Current</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold">Items ({order.items?.length??0})</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/20 text-left text-xs font-medium text-muted-foreground">
              {['#','Product','Unit','Qty','Unit Cost','Line Total'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {order.items?.map((it:any,i:number)=>{
                const lt=Number(it.quantity)*Number(it.unitCost);
                return(
                  <tr key={it.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{i+1}</td>
                    <td className="px-4 py-3 font-medium">{it.product?.name}</td>
                    <td className="px-4 py-3">{it.product?.unit}</td>
                    <td className="px-4 py-3 font-semibold">{Number(it.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3">{FMT(it.unitCost)}</td>
                    <td className="px-4 py-3 font-semibold">{FMT(lt)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-primary/5 border-t-2 border-border">
                <td colSpan={5} className="px-4 py-3 text-right font-bold">Grand Total</td>
                <td className="px-4 py-3 font-bold text-primary text-lg">{FMT(inv?.totalAmount??total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
