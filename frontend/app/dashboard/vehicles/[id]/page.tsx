'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Fuel, Wrench, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';

const PKR=(v:number|string)=>'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});

export default function VehicleDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({ type:'FUEL', amount:'', odometer:'', description:'', logDate: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  useEffect(()=>{ load(); },[id]);

  async function load(){
    setLoading(true);
    try{ setVehicle(await api.get<any>(`/vehicles/${id}`)); }
    catch{} finally{ setLoading(false); }
  }

  async function saveLog(){
    if(!form.amount||Number(form.amount)<=0){ setErrors({amount:'Enter valid amount'}); return; }
    setSaving(true);
    try{
      await api.post(`/vehicles/${id}/logs`,{
        type:form.type, amount:Number(form.amount),
        odometer:form.odometer?Number(form.odometer):undefined,
        description:form.description||undefined, logDate:form.logDate,
      });
      setShowLog(false); setForm({type:'FUEL',amount:'',odometer:'',description:'',logDate:new Date().toISOString().slice(0,10)});
      load();
    }catch(e:any){ setErrors({submit:e.message}); }
    finally{ setSaving(false); }
  }

  if(loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin"/>Loading...</div>;
  if(!vehicle) return <div className="text-red-500">Vehicle not found.</div>;

  const fuelTotal  = vehicle.logs?.filter((l:any)=>l.type==='FUEL').reduce((s:number,l:any)=>s+Number(l.amount),0)??0;
  const maintTotal = vehicle.logs?.filter((l:any)=>l.type==='MAINTENANCE').reduce((s:number,l:any)=>s+Number(l.amount),0)??0;

  return (
    <>
      <Modal open={showLog} onClose={()=>setShowLog(false)} title="Add Fuel / Maintenance Log" width="max-w-sm">
        <div className="flex flex-col gap-4">
          <Field label="Type" required>
            <Select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
              <option value="FUEL">Fuel</option>
              <option value="MAINTENANCE">Maintenance / Repair</option>
            </Select>
          </Field>
          <Field label="Amount (PKR)" required error={errors.amount}>
            <Input type="number" min={1} value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="5000" error={!!errors.amount}/>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Odometer (km)">
              <Input type="number" min={0} value={form.odometer} onChange={e=>setForm(p=>({...p,odometer:e.target.value}))} placeholder="Optional"/>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.logDate} onChange={e=>setForm(p=>({...p,logDate:e.target.value}))}/>
            </Field>
          </div>
          <Field label="Description">
            <Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Oil change, tire repair, full tank..."/>
          </Field>
          {errors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowLog(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label="Save Log" onClick={saveLog} type="button"/>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.back()} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><ArrowLeft size={14}/>Back</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{vehicle.plateNumber}</h1>
            <p className="text-sm text-muted-foreground">{vehicle.model??'—'} · {vehicle.driverName??'No driver assigned'}</p>
          </div>
          <button onClick={()=>setShowLog(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus size={15}/>Add Log</button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Fuel size={18}/></div>
            <div><p className="text-xs text-muted-foreground">Total Fuel Cost</p><p className="text-lg font-bold">{PKR(fuelTotal)}</p></div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600"><Wrench size={18}/></div>
            <div><p className="text-xs text-muted-foreground">Total Maintenance</p><p className="text-lg font-bold">{PKR(maintTotal)}</p></div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold text-primary">{PKR(fuelTotal+maintTotal)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30"><h3 className="font-semibold">Log History</h3></div>
          {vehicle.logs?.length===0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No logs recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                {['Date','Type','Description','Odometer','Amount'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>{vehicle.logs?.map((l:any)=>(
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(l.logDate).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.type==='FUEL'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{l.type}</span>
                  </td>
                  <td className="px-4 py-3">{l.description??'—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.odometer?`${l.odometer} km`:'—'}</td>
                  <td className="px-4 py-3 font-semibold">{PKR(l.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
