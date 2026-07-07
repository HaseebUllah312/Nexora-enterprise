'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { getCurrentUser } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';

interface SaleReturn { id:string; returnNo:string; reason:string; totalAmount:string; createdAt:string; invoice:{invoiceNo:string}; branch:{name:string}; items:any[]; }
interface PurchReturn { id:string; returnNo:string; reason:string; totalAmount:string; createdAt:string; invoice:{invoiceNo:string}; branch:{name:string}; items:any[]; }

const PKR = (v:number|string) => 'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});

function ReturnsPageContent() {
  const user = getCurrentUser();
  const searchParams = useSearchParams();
  const qInvoiceId = searchParams.get('invoiceId');
  const qType = searchParams.get('type') as 'sale' | 'purchase' | null;
  const [tab, setTab] = useState<'sale'|'purchase'>('sale');
  const [saleRet, setSaleRet]   = useState<SaleReturn[]>([]);
  const [purchRet, setPurchRet] = useState<PurchReturn[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [invoiceId, setInvoiceId] = useState('');
  const [reason, setReason]       = useState('');
  const [items, setItems]         = useState<{productId:string;productName:string;quantity:number;unitPrice:number;unitCost:number}[]>([]);
  const [invoices, setInvoices]   = useState<{id:string;invoiceNo:string;items:any[]}[]>([]);
  const [fErr, setFErr]           = useState<Record<string,string>>({});
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, p] = await Promise.all([
        api.get<SaleReturn[]>('/returns/sale'),
        api.get<PurchReturn[]>('/returns/purchase'),
      ]);
      setSaleRet(s); setPurchRet(p);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (qInvoiceId && (qType === 'sale' || qType === 'purchase')) {
      setTab(qType);
      
      const autoLoad = async () => {
        try {
          let fetchedInvoices: any[] = [];
          if (qType === 'sale') {
            const orders = await api.get<any[]>('/sales/orders?status=INVOICED');
            fetchedInvoices = orders.filter(o=>o.invoice).map(o=>({
              id: o.invoice.id, invoiceNo: o.invoice.invoiceNo,
              items: o.items.map((i:any)=>({ productId:i.productId, productName:i.product.name, quantity:Number(i.quantity), unitPrice:Number(i.unitPrice), unitCost:Number(i.unitPrice) })),
            }));
          } else {
            const orders = await api.get<any[]>('/purchases/orders?status=INVOICED');
            fetchedInvoices = orders.filter(o=>o.invoice).map(o=>({
              id: o.invoice.id, invoiceNo: o.invoice.invoiceNo,
              items: o.items.map((i:any)=>({ productId:i.productId, productName:i.product.name, quantity:Number(i.quantity), unitPrice:Number(i.unitCost), unitCost:Number(i.unitCost) })),
            }));
          }
          setInvoices(fetchedInvoices);
          
          const selected = fetchedInvoices.find(inv=>inv.id===qInvoiceId);
          if (selected) {
            setInvoiceId(qInvoiceId);
            setItems(selected.items.map((item: any)=>({...item, quantity: 1})));
            setShowForm(true);
          }
        } catch (e) {
          console.error('Failed to auto load return invoice:', e);
        }
      };
      
      autoLoad();
    }
  }, [qInvoiceId, qType]);

  async function openForm() {
    setInvoiceId(''); setReason(''); setItems([]); setFErr({});
    try {
      if (tab === 'sale') {
        const orders = await api.get<any[]>('/sales/orders?status=INVOICED');
        setInvoices(orders.filter(o=>o.invoice).map(o=>({
          id: o.invoice.id, invoiceNo: o.invoice.invoiceNo,
          items: o.items.map((i:any)=>({ productId:i.productId, productName:i.product.name, quantity:Number(i.quantity), unitPrice:Number(i.unitPrice), unitCost:Number(i.unitPrice) })),
        })));
      } else {
        const orders = await api.get<any[]>('/purchases/orders?status=INVOICED');
        setInvoices(orders.filter(o=>o.invoice).map(o=>({
          id: o.invoice.id, invoiceNo: o.invoice.invoiceNo,
          items: o.items.map((i:any)=>({ productId:i.productId, productName:i.product.name, quantity:Number(i.quantity), unitPrice:Number(i.unitCost), unitCost:Number(i.unitCost) })),
        })));
      }
    } catch {}
    setShowForm(true);
  }

  function selectInvoice(id:string) {
    setInvoiceId(id);
    const inv = invoices.find(i=>i.id===id);
    if (inv) setItems(inv.items.map(i=>({...i, quantity:1})));
  }

  const total = items.reduce((s,i)=>s+(i.quantity*(tab==='sale'?i.unitPrice:i.unitCost)),0);

  async function save() {
    const e:Record<string,string>={};
    if (!invoiceId)         e.invoiceId = 'Select invoice';
    if (!reason.trim())     e.reason    = 'Reason required';
    if (items.every(i=>i.quantity<=0)) e.items = 'At least one item must have qty > 0';
    setFErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const returnItems = items.filter(i=>i.quantity>0).map(i=>({
        productId:i.productId, productName:i.productName,
        quantity:i.quantity,
        ...(tab==='sale' ? {unitPrice:i.unitPrice} : {unitCost:i.unitCost}),
      }));
      await api.post(`/returns/${tab}`, {
        invoiceId, reason, branchId: user?.branch?.id, items: returnItems,
      });
      setShowForm(false); load();
    } catch (err:any) { setFErr({submit:err.message}); }
    finally { setSaving(false); }
  }

  const list = tab==='sale' ? saleRet : purchRet;
  const typeLabel = tab==='sale' ? 'Credit Note' : 'Debit Note';

  return (
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)}
        title={tab==='sale' ? 'New Sale Return (Credit Note)' : 'New Purchase Return (Debit Note)'}
        subtitle={tab==='sale' ? 'Customer returns goods — stock restored, invoice reduced' : 'Return goods to supplier — stock deducted, invoice reduced'}
        width="max-w-2xl">
        <div className="flex flex-col gap-4">
          <Field label="Select Invoice" required error={fErr.invoiceId}>
            <Select value={invoiceId} onChange={e=>selectInvoice(e.target.value)} error={!!fErr.invoiceId}>
              <option value="">Select invoice to return against...</option>
              {invoices.map(i=><option key={i.id} value={i.id}>{i.invoiceNo}</option>)}
            </Select>
          </Field>
          <Field label="Reason for Return" required error={fErr.reason}>
            <Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Damaged goods / Wrong item / Customer request..." error={!!fErr.reason}/>
          </Field>
          {items.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Return Quantities</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 text-left w-[50%]">Product</th>
                    <th className="px-3 py-2 text-left w-[20%]">Original Qty</th>
                    <th className="px-3 py-2 text-left w-[20%]">Return Qty</th>
                    <th className="px-3 py-2 text-right w-[10%]">Amount</th>
                  </tr></thead>
                  <tbody>
                    {items.map((item,i)=>{
                      const price = tab==='sale' ? item.unitPrice : item.unitCost;
                      return (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium">{item.productName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{invoices.find(inv=>inv.id===invoiceId)?.items[i]?.quantity ?? item.quantity}</td>
                          <td className="px-3 py-2">
                            <Input type="number" min={0} max={item.quantity}
                              value={item.quantity}
                              onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x))}
                              className="w-24"/>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{PKR(item.quantity * price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="bg-muted/30 border-t-2">
                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Total Return</td>
                    <td className="px-3 py-2 text-right font-bold text-primary">{PKR(total)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}
          {fErr.items  && <p className="text-xs text-red-500">{fErr.items}</p>}
          {fErr.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label={`Create ${typeLabel} — ${PKR(total)}`} onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell
        title="Returns" description="Sale returns (credit notes) and purchase returns (debit notes)"
        loading={loading} error={error} empty={list.length===0}
        emptyLabel={`No ${tab} returns yet.`}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['sale','purchase'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${tab===t?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>
                  {t==='sale'?'Sale Returns':'Purchase Returns'}
                </button>
              ))}
            </div>
            <button onClick={openForm}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
              <Plus size={16}/>{tab==='sale'?'Credit Note':'Debit Note'}
            </button>
          </div>
        }>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {[typeLabel+' #','Against Invoice','Branch','Reason','Amount','Date'].map(h=>(
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr></thead>
          <tbody>{list.map((r:any)=>(
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.returnNo}</td>
              <td className="px-4 py-3">{r.invoice?.invoiceNo}</td>
              <td className="px-4 py-3">{r.branch?.name}</td>
              <td className="px-4 py-3">{r.reason}</td>
              <td className="px-4 py-3 font-semibold text-red-600">{PKR(r.totalAmount)}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <ReturnsPageContent />
    </Suspense>
  );
}
