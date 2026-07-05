'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Branch { id:string; name:string; }
interface Props { open:boolean; onClose:()=>void; onSaved:()=>void; }

export function EmployeeForm({ open, onClose, onSaved }: Props) {
  const currentUser = getCurrentUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const blank = { name:'', designation:'', branchId:currentUser?.branch?.id??'', salary:'', joinDate:'' };
  const [form, setForm]     = useState(blank);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setForm({ ...blank, branchId: currentUser?.branch?.id??'' });
    api.get<Branch[]>('/branches').then(setBranches).catch(()=>{});
  }, [open]);

  function set(f:string, v:string) { setForm(p=>({...p,[f]:v})); setErrors(p=>({...p,[f]:''})); }

  function validate() {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.branchId)    e.branchId = 'Branch is required';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/employees', {
        ...form,
        salary: form.salary ? Number(form.salary) : undefined,
        joinDate: form.joinDate || undefined,
        designation: form.designation || undefined,
      });
      onSaved(); onClose();
    } catch (err:any) { setErrors({ submit: err.message }); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Employee" width="max-w-md">
      <div className="flex flex-col gap-4">
        <Field label="Full Name" required error={errors.name}>
          <Input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Muhammad Ali" error={!!errors.name}/>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Designation">
            <Input value={form.designation} onChange={e=>set('designation',e.target.value)} placeholder="Sales Staff"/>
          </Field>
          <Field label="Monthly Salary (PKR)">
            <Input type="number" min={0} value={form.salary} onChange={e=>set('salary',e.target.value)} placeholder="25000"/>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Branch" required error={errors.branchId}>
            <Select value={form.branchId} onChange={e=>set('branchId',e.target.value)} error={!!errors.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Join Date">
            <Input type="date" value={form.joinDate} onChange={e=>set('joinDate',e.target.value)}/>
          </Field>
        </div>
        {errors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label="Add Employee" onClick={handleSubmit} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
