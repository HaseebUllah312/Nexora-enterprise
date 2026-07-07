'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, CreditCard, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { printInvoice } from '@/components/ui/invoice-print';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

const PKR = (v:number|string) => 'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const FMT = (v:number|string) => 'PKR '+Number(v).toLocaleString('en-PK',{minimumFractionDigits:2});

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [order,    setOrder]    = useState<any>(null);
  const [company,  setCompany]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [showPay,  setShowPay]  = useState(false);
  const [amount,   setAmount]   = useState('');
  const [payLoad,  setPayLoad]  = useState(false);
  const [payErr,   setPayErr]   = useState('');
  const [payOk,    setPayOk]    = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const o = await api.get<any>(`/sales/orders/${id}`);
      setOrder(o);
      if (o.branchId || o.branch?.id) {
        const bid = o.branchId ?? o.branch?.id;
        api.get<any>(`/company-settings?branchId=${bid}`).then(setCompany).catch(()=>{});
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function pay() {
    if (!order?.invoice) return;
    const amt = Number(amount);
    const outstanding = Number(order.invoice.totalAmount) - Number(order.invoice.paidAmount);
    if (!amt || amt <= 0) { setPayErr('Enter a valid amount'); return; }
    if (amt > outstanding) { setPayErr(`Cannot exceed ${PKR(outstanding)}`); return; }
    setPayLoad(true); setPayErr('');
    try {
      await api.post('/sales/invoices/payment', { invoiceId: order.invoice.id, amount: amt });
      setPayOk(true); await load();
      setTimeout(()=>{ setShowPay(false); setPayOk(false); setAmount(''); }, 1500);
    } catch (e:any) { setPayErr(e.message); }
    finally { setPayLoad(false); }
  }

  function doPrint(format: 'a4' | 'thermal' = 'a4') {
    if (!order?.invoice) return;
    printInvoice({
      invoiceNo:     order.invoice.invoiceNo,
      orderNo:       order.orderNo,
      date:          order.invoice.createdAt,
      dueDate:       order.invoice.dueDate,
      paymentMethod: order.invoice.paymentMethod,
      paidAmount:    Number(order.invoice.paidAmount),
      customer:      order.customer,
      branch:        order.branch,
      items:         order.items.map((i:any) => ({
        productName: i.product.name, quantity: Number(i.quantity),
        unit: i.product.unit, unitPrice: Number(i.unitPrice), discount: Number(i.discount),
      })),
      company: company ?? undefined,
    }, format);
  }

  function doPrintQuotation(format: 'a4' | 'thermal' = 'a4') {
    printInvoice({
      invoiceNo:     order.orderNo,
      orderNo:       order.orderNo,
      date:          order.createdAt,
      paymentMethod: 'QUOTATION',
      paidAmount:    0,
      customer:      order.customer,
      branch:        order.branch,
      items:         order.items.map((i:any) => ({
        productName: i.product.name, quantity: Number(i.quantity),
        unit: i.product.unit, unitPrice: Number(i.unitPrice), discount: Number(i.discount),
      })),
      company: company ?? undefined,
      isQuotation:   true,
    }, format);
  }

  if (loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin"/>Loading invoice...</div>;
  if (!order)  return <div className="text-red-500">Invoice not found.</div>;

  const inv         = order.invoice;
  const outstanding = inv ? Number(inv.totalAmount) - Number(inv.paidAmount) : 0;
  const fullyPaid   = outstanding <= 0 && !!inv;
  const subtotal    = order.items?.reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unitPrice),0)??0;
  const discount    = order.items?.reduce((s:number,i:any)=>s+Number(i.discount),0)??0;
  const taxRate     = inv && inv.taxRate !== undefined ? Number(inv.taxRate) : (company?.taxRate ?? 0);
  const tax         = inv && inv.taxAmount !== undefined ? Number(inv.taxAmount) : Math.round((subtotal-discount)*taxRate/100*100)/100;

  return (
    <>
      <Modal open={showPay} onClose={()=>{setShowPay(false);setPayErr('');setAmount('');}}
        title="Record Payment" subtitle={`Outstanding: ${PKR(outstanding)}`} width="max-w-sm">
        <div className="flex flex-col gap-4">
          {payOk ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={40} className="text-emerald-500"/>
              <p className="font-bold text-emerald-600">Payment Recorded!</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
                <div className="flex justify-between"><span>Invoice Total</span><span className="font-semibold">{FMT(inv?.totalAmount??0)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span className="text-emerald-600 font-semibold">{FMT(inv?.paidAmount??0)}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Outstanding</span><span className="text-red-500">{FMT(outstanding)}</span>
                </div>
              </div>
              <Field label="Amount (PKR)" required error={payErr}>
                <Input type="number" min={1} max={outstanding} value={amount}
                  onChange={e=>{setAmount(e.target.value);setPayErr('');}} placeholder={outstanding.toString()}/>
              </Field>
              <button onClick={()=>setAmount(outstanding.toString())}
                className="rounded-md border border-border py-2 text-sm hover:bg-muted">Pay Full Amount — {PKR(outstanding)}</button>
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button onClick={()=>setShowPay(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
                <SubmitButton loading={payLoad} label="Save Payment" onClick={pay} type="button"/>
              </div>
            </>
          )}
        </div>
      </Modal>

      <div className="flex flex-col gap-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={()=>router.back()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><ArrowLeft size={14}/>Back</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{inv?.invoiceNo ?? order.orderNo}</h1>
            <p className="text-sm text-muted-foreground">{order.customer?.name} · {order.branch?.name}</p>
          </div>
          <div className="flex gap-2">
            {inv ? (
              <>
                <button onClick={() => doPrint('a4')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium"><Printer size={15}/>Print A4</button>
                <button onClick={() => doPrint('thermal')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium"><Printer size={15}/>Print Thermal (80mm)</button>
              </>
            ) : (
              <>
                <button onClick={() => doPrintQuotation('a4')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium"><Printer size={15}/>Print A4 Quotation</button>
                <button onClick={() => doPrintQuotation('thermal')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium"><Printer size={15}/>Print Thermal Quotation</button>
              </>
            )}
            {inv && !fullyPaid && <button onClick={()=>setShowPay(true)} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><CreditCard size={15}/>Record Payment</button>}
            {inv && <button onClick={()=>router.push(`/dashboard/returns?invoiceId=${inv.id}&type=sale`)} className="flex items-center gap-2 rounded-md border border-red-300 text-red-600 px-3 py-2 text-sm hover:bg-red-50"><RotateCcw size={15}/>Return</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Invoice summary */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold">Invoice Summary</h3>
            {inv ? (
              <>
                <div className="text-xs space-y-2">
                  {[['Invoice',inv.invoiceNo],['Order',order.orderNo],['Date',new Date(inv.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})],['Payment',inv.paymentMethod]].map(([k,v])=>(
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                  ))}
                  {inv.dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-medium text-red-500">{new Date(inv.dueDate).toLocaleDateString('en-PK')}</span></div>}
                </div>
                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{FMT(subtotal)}</span></div>
                  {discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="text-red-500">- {FMT(discount)}</span></div>}
                  {tax > 0 && <div className="flex justify-between"><span>GST ({taxRate}%)</span><span>{FMT(tax)}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total</span><span>{FMT(inv.totalAmount)}</span></div>
                  <div className="flex justify-between"><span>Paid</span><span className="text-emerald-600 font-semibold">{FMT(inv.paidAmount)}</span></div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span>Outstanding</span>
                    <span className={fullyPaid?'text-emerald-600':'text-red-500'}>{fullyPaid?'✓ Fully Paid':FMT(outstanding)}</span>
                  </div>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">No invoice yet — status: {order.status}</p>}
          </div>

          {/* Customer */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Customer</h3>
            <p className="font-bold text-base">{order.customer?.name}</p>
            {order.customer?.phone   && <p className="text-sm text-muted-foreground mt-1">{order.customer.phone}</p>}
            {order.customer?.address && <p className="text-sm text-muted-foreground">{order.customer.address}</p>}
            {order.customer?.taxNumber && <p className="text-xs text-muted-foreground mt-1">NTN: {order.customer.taxNumber}</p>}
          </div>

          {/* Status */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Order Status</h3>
            <div className="flex flex-col gap-2">
              {(['QUOTATION','CONFIRMED','INVOICED'] as const).map((s,i)=>{
                const stages = ['QUOTATION','CONFIRMED','INVOICED'];
                const done = stages.indexOf(order.status) >= i;
                return (
                  <div key={s} className={`flex items-center gap-2 text-sm ${done?'text-foreground':'text-muted-foreground'}`}>
                    <div className={`h-2 w-2 rounded-full ${done?'bg-primary':'bg-muted'}`}/>
                    {s.charAt(0)+s.slice(1).toLowerCase()}
                    {order.status===s && <span className="ml-auto text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Current</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold">Items ({order.items?.length ?? 0})</h3>
            {taxRate > 0 && <span className="text-xs text-muted-foreground">GST {taxRate}% applied</span>}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/20 text-left text-xs font-medium text-muted-foreground">
              {['#','Product','Unit','Qty','Unit Price','Discount','Line Total'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>
              {order.items?.map((item:any, i:number) => {
                const lineTotal = Number(item.quantity)*Number(item.unitPrice)-Number(item.discount);
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{i+1}</td>
                    <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                    <td className="px-4 py-3">{item.product?.unit}</td>
                    <td className="px-4 py-3 font-semibold">{Number(item.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3">{FMT(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-red-500">{Number(item.discount)>0?FMT(item.discount):'—'}</td>
                    <td className="px-4 py-3 font-semibold">{FMT(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">Subtotal</td>
                <td colSpan={2} className="px-4 py-2 font-medium">{FMT(subtotal)}</td>
              </tr>
              {discount>0 && <tr className="bg-red-50/30"><td colSpan={5} className="px-4 py-1.5 text-right text-sm text-red-500">Total Discount</td><td colSpan={2} className="px-4 py-1.5 text-red-500 font-medium">- {FMT(discount)}</td></tr>}
              {tax>0 && <tr className="bg-muted/20"><td colSpan={5} className="px-4 py-1.5 text-right text-sm">GST ({taxRate}%)</td><td colSpan={2} className="px-4 py-1.5 font-medium">{FMT(tax)}</td></tr>}
              <tr className="bg-primary/5 border-t-2 border-primary/20">
                <td colSpan={5} className="px-4 py-3 text-right font-bold text-base">Grand Total</td>
                <td colSpan={2} className="px-4 py-3 font-bold text-primary text-lg">{FMT(inv?.totalAmount ?? subtotal - discount + tax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
