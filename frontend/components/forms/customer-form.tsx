'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Branch { id: string; name: string; }
interface Customer { id: string; name: string; phone?: string; email?: string; address?: string;
  taxNumber?: string; creditLimit: string; branchId: string; }

interface Props { open: boolean; onClose: () => void; onSaved: () => void; customer?: Customer | null; }

export function CustomerForm({ open, onClose, onSaved, customer }: Props) {
  const currentUser = getCurrentUser();
  const isEdit = !!customer;
  const [branches, setBranches] = useState<Branch[]>([]);
  const blank = { name:'', phone:'', email:'', address:'', taxNumber:'', creditLimit:'0', branchId: currentUser?.branch?.id ?? '' };
  const [form, setForm]     = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    api.get<Branch[]>('/branches').then(setBranches).catch(() => {});
    if (customer) {
      setForm({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '',
        address: customer.address ?? '', taxNumber: customer.taxNumber ?? '',
        creditLimit: customer.creditLimit, branchId: customer.branchId });
    } else { setForm({ ...blank, branchId: currentUser?.branch?.id ?? '' }); }
  }, [open, customer]);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Customer name is required';
    if (!form.branchId)    e.branchId = 'Branch is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = { ...form, creditLimit: Number(form.creditLimit),
        phone: form.phone || undefined, email: form.email || undefined,
        address: form.address || undefined, taxNumber: form.taxNumber || undefined };
      if (isEdit) await api.patch(`/customers/${customer!.id}`, body);
      else        await api.post('/customers', body);
      onSaved(); onClose();
    } catch (err: any) { setErrors({ submit: err.message }); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Customer' : 'Add Customer'} width="max-w-lg">
      <div className="flex flex-col gap-4">
        <Field label="Customer Name" required error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ahmed Trading Co." error={!!errors.name} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="03001234567" />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ahmed@example.com" error={!!errors.email} />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Shop #12, Main Market, Lahore" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="NTN / Tax Number">
            <Input value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)} placeholder="1234567-8" />
          </Field>
          <Field label="Credit Limit (PKR)" hint="0 = cash only">
            <Input type="number" min={0} value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
          </Field>
        </div>
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
          <SubmitButton loading={loading} label={isEdit ? 'Save Changes' : 'Add Customer'} onClick={handleSubmit} type="button" />
        </div>
      </div>
    </Modal>
  );
}
