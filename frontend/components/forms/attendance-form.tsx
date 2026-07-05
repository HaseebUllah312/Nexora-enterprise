'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Employee { id:string; name:string; branch:{name:string}; }
interface Props { open:boolean; onClose:()=>void; onSaved:()=>void; }

const STATUSES = ['PRESENT','ABSENT','LEAVE','HALF_DAY'];

export function AttendanceForm({ open, onClose, onSaved }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<{employeeId:string; status:string; checkIn:string; checkOut:string}[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(0);

  useEffect(()=>{
    if(!open) return;
    setSaved(0); setErrors({});
    api.get<Employee[]>('/employees').then(emp => {
      setEmployees(emp);
      setRows(emp.map(e => ({ employeeId: e.id, status:'PRESENT', checkIn:'09:00', checkOut:'17:00' })));
    }).catch(()=>{});
  },[open]);

  function setRow(i:number, f:string, v:string){
    setRows(r => r.map((x,j) => j===i ? {...x,[f]:v} : x));
  }

  async function save(){
    if(!date){ setErrors({date:'Date required'}); return; }
    setLoading(true);
    let count = 0;
    for(const row of rows){
      try{
        await api.post('/employees/attendance', {
          employeeId: row.employeeId,
          date,
          status: row.status,
          checkIn:  row.status==='PRESENT'||row.status==='HALF_DAY' ? `${date}T${row.checkIn}:00.000Z` : undefined,
          checkOut: row.status==='PRESENT'||row.status==='HALF_DAY' ? `${date}T${row.checkOut}:00.000Z` : undefined,
        });
        count++;
      } catch {}
    }
    setSaved(count); setLoading(false);
    onSaved();
    setTimeout(()=>onClose(), 1500);
  }

  return(
    <Modal open={open} onClose={onClose} title="Mark Attendance" subtitle={`Bulk attendance entry — ${employees.length} employees`} width="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={date} onChange={e=>setDate(e.target.value)} error={!!errors.date} className="w-44"/>
          </Field>
          {saved>0 && <p className="text-sm text-emerald-600 font-medium">✓ Saved {saved} records</p>}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2 w-[30%]">Employee</th>
                <th className="px-4 py-2 w-[20%]">Status</th>
                <th className="px-4 py-2 w-[20%]">Check In</th>
                <th className="px-4 py-2 w-[20%]">Check Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,i)=>{
                const emp = employees[i];
                const needsTime = row.status==='PRESENT'||row.status==='HALF_DAY';
                return(
                  <tr key={row.employeeId} className={`border-b border-border last:border-0 ${row.status==='ABSENT'?'bg-red-50/30 dark:bg-red-900/10':row.status==='LEAVE'?'bg-blue-50/30 dark:bg-blue-900/10':''}`}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{emp?.name}</p>
                      <p className="text-xs text-muted-foreground">{emp?.branch.name}</p>
                    </td>
                    <td className="px-4 py-2">
                      <Select value={row.status} onChange={e=>setRow(i,'status',e.target.value)} className="text-xs">
                        {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      {needsTime
                        ? <Input type="time" value={row.checkIn} onChange={e=>setRow(i,'checkIn',e.target.value)} className="text-xs"/>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {needsTime
                        ? <Input type="time" value={row.checkOut} onChange={e=>setRow(i,'checkOut',e.target.value)} className="text-xs"/>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={`Save Attendance (${rows.length} employees)`} onClick={save} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
