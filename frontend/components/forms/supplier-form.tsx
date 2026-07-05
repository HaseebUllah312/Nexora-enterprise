'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Branch { id: string; name: string; }
interface Supplier { id: string; name: string; phone?: string; email?: string; address?: string; taxNumber?: string; branchId: string; }

interface Props { open: boolean; onClose: () => void; onSaved: () => void; supplier?: Supplier | null; }

export function SupplierForm({ open, onClose, onSaved, supplier }: Props) {
  const currentUser = getCurrentUser();
  const isEdit = !!supplier;
  const [branches, setBranches] = useState<Branch[]>([]);
  const blank = { name:'', phone:'', email:'', address:'', taxNumber:'', branchId: currentUser?.branch?.id ?? '' };
  const [form, setForm]     = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    api.get<Branch[]>('/branches').then(setBranches).catch(() => {});
    if (supplier) {
      setForm({ name: supplier.name, phone: supplier.phone ?? '', email: supplier.email ?? '',
        address: supplier.address ?? '', taxNumber: supplier.taxNumber ?? '', branchId: supplier.branchId });
    } else { setForm({ ...blank, branchId: currentUser?.branch?.id ?? '' }); }
  }, [open, supplier]);

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: '' })); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Supplier name is required';
    if (!form.branchId)    e.branchId = 'Branch is required';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = { ...form, phone: form.phone || undefined, email: form.email || undefined,
        address: form.address || undefined, taxNumber: form.taxNumber || undefined };
      if (isEdit) await api.patch(`/suppliers/${supplier!.id}`, body);
      else        await api.post('/suppliers', body);
      onSaved(); onClose();
    } catch (err: any) { setErrors({ submit: err.message }); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Supplier' : 'Add Supplier'} width="max-w-lg">
      <div className="flex flex-col gap-4">
        <Field label="Supplier Name" required error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ali PVC Industries" error={!!errors.name} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="03211234567" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="supplier@example.com" />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Industrial Area, Karachi" />
        </Field>
        <Field label="NTN / Tax Number">
          <Input value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)} placeholder="1234567-8" />
        </Field>
        <Field label="Branch" required error={errors.branchId}>
          <select value={form.branchId} onChange={e => set('branchId', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {errors.submit && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={isEdit ? 'Save Changes' : 'Add Supplier'} onClick={handleSubmit} type="button" />
        </div>
      </div>
    </Modal>
  );
}
