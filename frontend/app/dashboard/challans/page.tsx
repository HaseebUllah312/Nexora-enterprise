'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Printer, CheckCircle, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { getCurrentUser } from '@/lib/auth';

interface Challan { id:string;challanNo:string;status:string;deliveredTo?:string;driverName?:string;createdAt:string;deliveredAt?:string;salesOrder:{orderNo:string;customer:{name:string}};vehicle?:{plateNumber:string}|null;branch:{name:string};items:any[]; }

const ST:Record<string,string>={PENDING:'bg-amber-100 text-amber-700',DELIVERED:'bg-emerald-100 text-emerald-700',RETURNED:'bg-red-100 text-red-700'};

export default function ChallansPage() {
  const user = getCurrentUser();
  const [challans,  setChallans] = useState<Challan[]>([]);
  const [orders,    setOrders]   = useState<{id:string;orderNo:string;customer:{name:string}}[]>([]);
  const [vehicles,  setVehicles] = useState<{id:string;plateNumber:string;driverName?:string}[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState<string|null>(null);
  const [showForm,  setShowForm] = useState(false);
  const [form,      setForm]     = useState({ salesOrderId:'', vehicleId:'', driverName:'', branchId: user?.branch?.id??'' });
  const [fErr,      setFErr]     = useState<Record<string,string>>({});
  const [saving,    setSaving]   = useState(false);
  const [printing,  setPrinting] = useState<Challan|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, o, v] = await Promise.all([
        api.get<Challan[]>('/sales/challans'),
        api.get<any[]>('/sales/orders?status=CONFIRMED'),
        api.get<any[]>('/vehicles'),
      ]);
      setChallans(c); setOrders(o); setVehicles(v);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setF(f:string, v:string) { setForm(p=>({...p,[f]:v})); setFErr(p=>({...p,[f]:''})); }

  async function save() {
    if (!form.salesOrderId) { setFErr({salesOrderId:'Select a sales order'}); return; }
    setSaving(true);
    try {
      await api.post('/sales/challans', { ...form, vehicleId: form.vehicleId||undefined });
      setShowForm(false); setForm({ salesOrderId:'', vehicleId:'', driverName:'', branchId: user?.branch?.id??'' });
      load();
    } catch (err:any) { setFErr({submit:err.message}); }
    finally { setSaving(false); }
  }

  async function markDelivered(id:string) {
    try { await api.patch(`/sales/challans/${id}/deliver`); load(); } catch (e:any) { alert(e.message); }
  }

  function printChallan(c:Challan) {
    const rows = (c.items as any[]).map((it,i)=>`
      <tr style="background:${i%2?'#f8fafc':'#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i+1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${it.productName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${it.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:bold">${it.quantity}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>${c.challanNo}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20mm}table{width:100%;border-collapse:collapse}</style></head>
      <body>
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:20px">
        <div><h1 style="margin:0;font-size:22px">Nexora Enterprise</h1><p style="margin:4px 0;color:#555">${c.branch.name}</p></div>
        <div style="text-align:right"><h2 style="margin:0;font-size:18px;color:#2563eb">DELIVERY CHALLAN</h2>
          <p style="margin:4px 0;font-weight:bold">${c.challanNo}</p>
          <p style="margin:2px 0;color:#555">Date: ${new Date(c.createdAt).toLocaleDateString('en-PK')}</p>
          <p style="margin:2px 0;color:#555">Order: ${c.salesOrder.orderNo}</p></div>
      </div>
      <div style="display:flex;gap:40px;margin-bottom:20px">
        <div><p style="font-size:10px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Deliver To</p>
          <p style="font-weight:bold;font-size:14px;margin:0">${c.deliveredTo||c.salesOrder.customer.name}</p></div>
        ${c.vehicle?`<div><p style="font-size:10px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Vehicle</p>
          <p style="font-weight:bold;margin:0">${c.vehicle.plateNumber}</p></div>`:''}
        ${c.driverName?`<div><p style="font-size:10px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Driver</p>
          <p style="font-weight:bold;margin:0">${c.driverName}</p></div>`:''}
      </div>
      <table><thead><tr style="background:#2563eb;color:white">
        <th style="padding:8px 12px;text-align:left;width:5%">#</th>
        <th style="padding:8px 12px;text-align:left;width:60%">Product</th>
        <th style="padding:8px 12px;text-align:center;width:15%">Unit</th>
        <th style="padding:8px 12px;text-align:center;width:20%">Quantity</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:40px;display:flex;justify-content:space-between">
        <div style="border-top:1px solid #000;width:200px;padding-top:4px;text-align:center;font-size:11px;color:#555">Prepared By</div>
        <div style="border-top:1px solid #000;width:200px;padding-top:4px;text-align:center;font-size:11px;color:#555">Received By (Signature)</div>
      </div>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, `Delivery Challan — ${c.challanNo}`);
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();window.close();}<\/script></body></html>'));
    w.document.close();
  }

  return (
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Create Delivery Challan" subtitle="Generates a printable dispatch document for the delivery driver" width="max-w-md">
        <div className="flex flex-col gap-4">
          <Field label="Sales Order" required error={fErr.salesOrderId}>
            <Select value={form.salesOrderId} onChange={e=>setF('salesOrderId',e.target.value)} error={!!fErr.salesOrderId}>
              <option value="">Select confirmed order...</option>
              {orders.map(o=><option key={o.id} value={o.id}>{o.orderNo} — {o.customer.name}</option>)}
            </Select>
          </Field>
          <Field label="Vehicle" hint="Optional — select delivery vehicle">
            <Select value={form.vehicleId} onChange={e=>{ setF('vehicleId',e.target.value); const v=vehicles.find(x=>x.id===e.target.value); if(v?.driverName) setF('driverName',v.driverName); }}>
              <option value="">No vehicle selected</option>
              {vehicles.map(v=><option key={v.id} value={v.id}>{v.plateNumber}{v.driverName?` — ${v.driverName}`:''}</option>)}
            </Select>
          </Field>
          <Field label="Driver Name">
            <input value={form.driverName} onChange={e=>setF('driverName',e.target.value)} placeholder="Ahmed Khan"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
          </Field>
          {fErr.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label="Create Challan" onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell title="Delivery Challans" description="Dispatch documents for deliveries — print and send with driver"
        loading={loading} error={error} empty={challans.length===0} emptyLabel="No delivery challans yet."
        action={<button onClick={()=>setShowForm(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"><Plus size={16}/>New Challan</button>}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Challan #','Order','Customer','Driver','Vehicle','Status','Date','Actions'].map(h=>(
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr></thead>
          <tbody>{challans.map(c=>(
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.challanNo}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{c.salesOrder.orderNo}</td>
              <td className="px-4 py-3 font-medium">{c.salesOrder.customer.name}</td>
              <td className="px-4 py-3">{c.driverName||'—'}</td>
              <td className="px-4 py-3">{c.vehicle?.plateNumber||'—'}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ST[c.status]||''}`}>{c.status}</span></td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  <button onClick={()=>printChallan(c)} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                    <Printer size={11}/>Print
                  </button>
                  {c.status==='PENDING' && (
                    <button onClick={()=>markDelivered(c.id)} className="flex items-center gap-1 rounded border border-emerald-300 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50">
                      <CheckCircle size={11}/>Delivered
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}
