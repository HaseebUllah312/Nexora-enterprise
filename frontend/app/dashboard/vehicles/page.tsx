'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

interface Vehicle { id:string; plateNumber:string; model?:string; driverName?:string; branch:{name:string}; _count:{deliveries:number}; }
interface Branch { id:string; name:string; }

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ plateNumber:'', model:'', driverName:'', branchId:'' });
  const [fErrors, setFErrors]   = useState<Record<string,string>>({});
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [v, b] = await Promise.all([api.get<Vehicle[]>('/vehicles'), api.get<Branch[]>('/branches')]);
      setVehicles(v); setBranches(b);
    } catch (e:any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(f:string, v:string) { setForm(p=>({...p,[f]:v})); setFErrors(p=>({...p,[f]:''})); }

  async function save() {
    const e: Record<string,string> = {};
    if (!form.plateNumber.trim()) e.plateNumber = 'Plate number required';
    if (!form.branchId)           e.branchId    = 'Branch required';
    setFErrors(e); if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api.post('/vehicles', { ...form, model:form.model||undefined, driverName:form.driverName||undefined });
      setShowForm(false); setForm({ plateNumber:'', model:'', driverName:'', branchId:'' });
      load();
    } catch (err:any) { setFErrors({ submit: err.message }); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Add Vehicle" width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plate Number" required error={fErrors.plateNumber}>
              <Input value={form.plateNumber} onChange={e=>set('plateNumber',e.target.value)} placeholder="LHR-1234" error={!!fErrors.plateNumber}/>
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={e=>set('model',e.target.value)} placeholder="Suzuki Carry"/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Driver Name">
              <Input value={form.driverName} onChange={e=>set('driverName',e.target.value)} placeholder="Ahmed Khan"/>
            </Field>
            <Field label="Branch" required error={fErrors.branchId}>
              <Select value={form.branchId} onChange={e=>set('branchId',e.target.value)} error={!!fErrors.branchId}>
                <option value="">Select branch...</option>
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </div>
          {fErrors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErrors.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label="Add Vehicle" onClick={save} type="button"/>
          </div>
        </div>
      </Modal>

      <DataTableShell title="Vehicles & Fleet" description="Vehicle registration, drivers and delivery tracking"
        loading={loading} error={error} empty={vehicles.length===0} emptyLabel="No vehicles registered."
        action={
          <button onClick={()=>setShowForm(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
            <Plus size={16}/> Add Vehicle
          </button>
        }>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Plate','Model','Driver','Branch','Total Deliveries'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>{vehicles.map(v=>(
            <tr key={v.id} onClick={()=>router.push(`/dashboard/vehicles/${v.id}`)} className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
              <td className="px-4 py-3 font-mono font-semibold flex items-center gap-2"><Truck size={14} className="text-muted-foreground"/>{v.plateNumber}</td>
              <td className="px-4 py-3">{v.model||'—'}</td>
              <td className="px-4 py-3">{v.driverName||'—'}</td>
              <td className="px-4 py-3">{v.branch.name}</td>
              <td className="px-4 py-3">{v._count.deliveries}</td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}
