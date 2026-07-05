'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';

interface Category { id: string; name: string; }
interface Product  { id: string; sku: string; productCode: string; barcode?: string; name: string;
  brand?: string; size?: string; unit: string; purchasePrice: string; salePrice: string;
  minimumStock: string; openingStock: string; isRawMaterial: boolean; categoryId?: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: Product | null; // null = create, Product = edit
}

const UNITS = ['PCS', 'KG', 'METER', 'FOOT', 'SET', 'BOX', 'BUNDLE', 'LITER', 'TON'];

export function ProductForm({ open, onClose, onSaved, product }: Props) {
  const isEdit = !!product;
  const [categories, setCategories] = useState<Category[]>([]);

  const blank = { sku:'', productCode:'', barcode:'', name:'', brand:'', size:'', unit:'PCS',
    categoryId:'', purchasePrice:'', salePrice:'', openingStock:'0', minimumStock:'0', isRawMaterial: false };

  const [form, setForm] = useState(blank);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
    if (product) {
      setForm({
        sku: product.sku, productCode: product.productCode, barcode: product.barcode ?? '',
        name: product.name, brand: product.brand ?? '', size: product.size ?? '',
        unit: product.unit, categoryId: product.categoryId ?? '', purchasePrice: product.purchasePrice,
        salePrice: product.salePrice, openingStock: product.openingStock,
        minimumStock: product.minimumStock, isRawMaterial: product.isRawMaterial,
      });
    } else {
      setForm(blank);
    }
  }, [open, product]);

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.sku.trim())          e.sku          = 'SKU is required';
    if (!form.productCode.trim())  e.productCode  = 'Product code is required';
    if (!form.name.trim())         e.name         = 'Product name is required';
    if (!form.unit)                e.unit         = 'Unit is required';
    if (!form.purchasePrice || Number(form.purchasePrice) < 0) e.purchasePrice = 'Valid purchase price required';
    if (!form.salePrice     || Number(form.salePrice) < 0)     e.salePrice     = 'Valid sale price required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        salePrice:     Number(form.salePrice),
        openingStock:  Number(form.openingStock),
        minimumStock:  Number(form.minimumStock),
        categoryId:    form.categoryId || undefined,
        barcode:       form.barcode    || undefined,
      };
      if (isEdit) {
        await api.patch(`/products/${product!.id}`, body);
      } else {
        await api.post('/products', body);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to save product' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? `Edit Product — ${product?.name}` : 'Add New Product'}
      subtitle="PVC pipe, PPRC fitting, sanitary item, raw material, or accessory"
      width="max-w-2xl">
      <div className="flex flex-col gap-4">

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU" required error={errors.sku}>
            <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="PVC-2IN-001" error={!!errors.sku} />
          </Field>
          <Field label="Product Code" required error={errors.productCode}>
            <Input value={form.productCode} onChange={e => set('productCode', e.target.value)} placeholder="PC-001" error={!!errors.productCode} />
          </Field>
        </div>

        <Field label="Product Name" required error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="PVC Pipe 2 Inch" error={!!errors.name} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Brand">
            <Input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Local / Imported" />
          </Field>
          <Field label="Size">
            <Input value={form.size} onChange={e => set('size', e.target.value)} placeholder='2", 4", 20mm...' />
          </Field>
          <Field label="Unit" required error={errors.unit}>
            <Select value={form.unit} onChange={e => set('unit', e.target.value)} error={!!errors.unit}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <Select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div onClick={() => set('isRawMaterial', !form.isRawMaterial)}
                className={`relative h-5 w-9 rounded-full transition-colors ${form.isRawMaterial ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isRawMaterial ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm">Raw Material</span>
            </label>
          </div>
        </div>

        <Field label="Barcode" hint="Optional — scan or type barcode number">
          <Input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="6934177..." />
        </Field>

        {/* Pricing */}
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pricing</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase Price (PKR)" required error={errors.purchasePrice}>
              <Input type="number" min={0} value={form.purchasePrice}
                onChange={e => set('purchasePrice', e.target.value)} placeholder="0" error={!!errors.purchasePrice} />
            </Field>
            <Field label="Sale Price (PKR)" required error={errors.salePrice}>
              <Input type="number" min={0} value={form.salePrice}
                onChange={e => set('salePrice', e.target.value)} placeholder="0" error={!!errors.salePrice} />
            </Field>
          </div>
          {form.purchasePrice && form.salePrice && Number(form.salePrice) > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Margin: PKR {(Number(form.salePrice) - Number(form.purchasePrice)).toLocaleString()}
              {' '}({(((Number(form.salePrice) - Number(form.purchasePrice)) / Number(form.salePrice)) * 100).toFixed(1)}%)
            </p>
          )}
        </div>

        {/* Stock settings */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Opening Stock" hint="Initial quantity on hand">
            <Input type="number" min={0} value={form.openingStock} onChange={e => set('openingStock', e.target.value)} />
          </Field>
          <Field label="Minimum Stock" hint="Alert threshold for low stock">
            <Input type="number" min={0} value={form.minimumStock} onChange={e => set('minimumStock', e.target.value)} />
          </Field>
        </div>

        {errors.submit && (
          <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={isEdit ? 'Save Changes' : 'Add Product'} onClick={handleSubmit} type="button" />
        </div>
      </div>
    </Modal>
  );
}
