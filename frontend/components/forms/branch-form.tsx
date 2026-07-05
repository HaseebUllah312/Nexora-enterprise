'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Branch { id:string; name:string; code:string; address?:string; city?:string; phone?:string; isMainBranch:boolean; }
interface Props { open:boolean; onClose:()=>void; onSaved:()=>void; branch?:Branch|null; }

export function BranchForm({ open, onClose, onSaved, branch }: Props) {
  const isEdit = !!branch;
  const blank = { name:'', code:'', address:'', city:'', phone:'', isMainBranch: false };
  const [form, setForm]     = useState(blank);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (branch) setForm({ name:branch.name, code:branch.code, address:branch.address??'', city:branch.city??'', phone:branch.phone??'', isMainBranch:branch.isMainBranch });
    else setForm(blank);
  }, [open, branch]);

  function set(f:string, v:string|boolean) { setForm(p=>({...p,[f]:v})); setErrors(p=>({...p,[f]:''})); }

  function validate() {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = 'Branch name is required';
    if (!form.code.trim()) e.code = 'Branch code is required';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = { ...form, address:form.address||undefined, city:form.city||undefined, phone:form.phone||undefined };
      if (isEdit) await api.patch(`/branches/${branch!.id}`, body);
      else await api.post('/branches', body);
      onSaved(); onClose();
    } catch (err:any) { setErrors({ submit: err.message }); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Branch' : 'Add New Branch'} width="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Branch Name" required error={errors.name}>
            <Input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Lahore Branch" error={!!errors.name}/>
          </Field>
          <Field label="Branch Code" required error={errors.code} hint="Short unique code e.g. LHR">
            <Input value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="LHR" error={!!errors.code}/>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <Input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Lahore"/>
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="042-1234567"/>
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Shop #1, Main Bazaar..."/>
        </Field>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div onClick={()=>set('isMainBranch',!form.isMainBranch)}
            className={`relative h-5 w-9 rounded-full transition-colors ${form.isMainBranch?'bg-primary':'bg-muted-foreground/30'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isMainBranch?'translate-x-4':'translate-x-0.5'}`}/>
          </div>
          <span className="text-sm">Main / Head Office</span>
        </label>
        {errors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={isEdit?'Save Changes':'Add Branch'} onClick={handleSubmit} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
