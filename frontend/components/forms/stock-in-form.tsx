'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Product   { id: string; name: string; sku: string; unit: string; }
interface Warehouse { id: string; name: string; branchId: string; branch: { name: string }; }

interface Props { open: boolean; onClose: () => void; onSaved: () => void; mode: 'in' | 'out' | 'adjust'; }

export function StockMovementForm({ open, onClose, onSaved, mode }: Props) {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [productId,   setProductId]   = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity,    setQuantity]    = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [reason,      setReason]      = useState('');

  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setProductId(''); setWarehouseId(''); setQuantity(''); setBatchNumber(''); setReason('');
    Promise.all([
      api.get<Product[]>('/products'),
      api.get<Warehouse[]>('/warehouses'),
    ]).then(([p, w]) => { setProducts(p); setWarehouses(w); });
  }, [open]);

  const selectedProduct = products.find(p => p.id === productId);

  function validate() {
    const e: Record<string, string> = {};
    if (!productId)              e.productId   = 'Select a product';
    if (!warehouseId)            e.warehouseId = 'Select a warehouse';
    if (!quantity || Number(quantity) <= 0) e.quantity = 'Enter a valid quantity';
    if (mode === 'adjust' && !reason.trim()) e.reason = 'Reason is required for adjustments';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = { productId, warehouseId, quantity: Number(quantity),
        batchNumber: batchNumber || undefined, notes: reason || undefined };

      if (mode === 'in')     await api.post('/inventory/stock-in', body);
      else if (mode === 'out') await api.post('/inventory/stock-out', body);
      else await api.post('/inventory/adjustment', { ...body, newQuantity: Number(quantity), reason });

      onSaved(); onClose();
    } catch (err: any) { setErrors({ submit: err.message }); }
    finally { setLoading(false); }
  }

  const TITLES = { in: 'Stock In — Receive Goods', out: 'Stock Out — Issue Goods', adjust: 'Stock Adjustment — Physical Count' };
  const SUBTITLES = { in: 'Add stock to a warehouse', out: 'Remove stock from a warehouse', adjust: 'Set the actual quantity from a physical count' };
  const QTY_LABEL = { in: 'Quantity to Add', out: 'Quantity to Remove', adjust: 'Actual Quantity on Hand (new count)' };
  const COLORS = { in: 'bg-emerald-600', out: 'bg-red-500', adjust: 'bg-amber-500' };

  return (
    <Modal open={open} onClose={onClose} title={TITLES[mode]} subtitle={SUBTITLES[mode]} width="max-w-md">
      <div className="flex flex-col gap-4">

        <Field label="Product" required error={errors.productId}>
          <Select value={productId} onChange={e => setProductId(e.target.value)} error={!!errors.productId}>
            <option value="">Select product...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
          </Select>
        </Field>

        <Field label="Warehouse" required error={errors.warehouseId}>
          <Select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} error={!!errors.warehouseId}>
            <option value="">Select warehouse...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.branch.name} — {w.name}</option>
            ))}
          </Select>
        </Field>

        <Field label={QTY_LABEL[mode]} required error={errors.quantity}
          hint={selectedProduct ? `Unit: ${selectedProduct.unit}` : undefined}>
          <Input type="number" min={0} value={quantity} onChange={e => setQuantity(e.target.value)}
            placeholder="0" error={!!errors.quantity} />
        </Field>

        <Field label="Batch Number" hint="Optional — for batch tracking">
          <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="BATCH-2024-001" />
        </Field>

        {(mode === 'out' || mode === 'adjust') && (
          <Field label={mode === 'adjust' ? 'Reason for Adjustment' : 'Notes'} required={mode === 'adjust'} error={errors.reason}>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder={mode === 'adjust' ? 'Physical count, damage, correction...' : 'Internal use, sample...'} />
          </Field>
        )}

        {errors.submit && (
          <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={mode === 'in' ? 'Add Stock' : mode === 'out' ? 'Remove Stock' : 'Save Adjustment'}
            onClick={handleSubmit} type="button" />
        </div>
      </div>
    </Modal>
  );
}
