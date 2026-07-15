'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, AlertTriangle, Package, BookOpen, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { ProductForm } from '@/components/forms/product-form';
import { Pagination } from '@/components/ui/pagination';

interface Product {
  id:string; sku:string; productCode:string; barcode?:string; name:string;
  brand?:string; size?:string; unit:string; purchasePrice:string; salePrice:string;
  openingStock:string; minimumStock:string; isRawMaterial:boolean; categoryId?:string;
  category?:{name:string}|null; stock?:{quantity:string}[];
}

const PKR = (v:string|number) => 'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const PAGE_SIZE = 20;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string|null>(null);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState({ category:'', raw:'' });
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Product|null>(null);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [importing, setImporting] = useState(false);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length <= 1) {
          alert('Spreadsheet is empty or has no data.');
          setImporting(false);
          return;
        }

        const headers = data[0].map(h => String(h || '').trim());
        const rows = data.slice(1);

        const mappedProducts = rows.map(row => {
          const getVal = (colName: string) => {
            const index = headers.findIndex(h => h.toLowerCase().includes(colName.toLowerCase()));
            return index !== -1 ? row[index] : undefined;
          };

          const type = String(getVal('type') || 'Product').trim();
          const categoryName = String(getVal('group') || getVal('category') || '').trim();
          const brand = getVal('brand') ? String(getVal('brand')).trim() : null;
          const productCode = String(getVal('item code') || getVal('code') || '').trim();
          const name = String(getVal('product name') || getVal('name') || '').trim();
          const unit = String(getVal('unit') || 'PCS').trim();
          const openingStock = Number(getVal('opening stock') || 0);
          const purchasePrice = Number(getVal('purchase price') || getVal('purchase') || 0);
          const salePrice = Number(getVal('sale price') || getVal('sale') || 0);

          return {
            categoryName,
            brand,
            productCode,
            sku: productCode,
            name,
            unit,
            openingStock,
            purchasePrice,
            salePrice
          };
        }).filter(p => p.name && p.productCode);

        if (mappedProducts.length === 0) {
          alert('No valid products found to import. Please check column headers (e.g. Product Name, Item Code, Sale Price, Group).');
          setImporting(false);
          return;
        }

        if (confirm(`Are you sure you want to import ${mappedProducts.length} products?`)) {
          const res = await api.post<{ success: boolean; count: number }>('/products/import', { products: mappedProducts });
          if (res.success) {
            alert(`Successfully imported/updated ${res.count} products!`);
            load();
          } else {
            alert('Import failed.');
          }
        }
      } catch (err: any) {
        alert(err.message || 'Error parsing Excel file.');
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (search)        q.set('search', search);
      if (filter.raw)    q.set('isRawMaterial', filter.raw);
      const data = await api.get<Product[]>(`/products?${q}`);
      // client-side pagination since backend returns all
      setTotal(data.length);
      setProducts(data.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE));
      // low stock
      const low = data.filter(p=>{
        const qty = p.stock?.reduce((s:number,st:any)=>s+Number(st.quantity),0)??0;
        return qty <= Number(p.minimumStock) && Number(p.minimumStock) > 0;
      });
      setLowStock(low);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, filter, page]);

  useEffect(()=>{ setPage(1); },[search, filter]);
  useEffect(()=>{ load(); },[load]);

  return (
    <>
      <ProductForm open={showForm}
        onClose={()=>{ setShowForm(false); setEditing(null); }}
        onSaved={load} product={editing}/>

      {lowStock.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15}/>
            {lowStock.length} product{lowStock.length!==1?'s':''} below minimum stock:&nbsp;
            {lowStock.slice(0,4).map(p=><span key={p.id} className="font-normal">{p.name}{lowStock.indexOf(p)<Math.min(3,lowStock.length-1)?', ':''}</span>)}
            {lowStock.length>4 && ` and ${lowStock.length-4} more`}
          </p>
        </div>
      )}

      <DataTableShell title="Products"
        description={`${total} products — PVC pipes, PPRC fittings, sanitary & raw materials`}
        loading={loading} error={error}
        empty={products.length===0} emptyLabel="No products found. Add your first product."
        action={
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                placeholder="Search name, SKU, barcode..."
                className="pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary w-52"/>
            </div>
            <select value={filter.raw} onChange={e=>setFilter(p=>({...p,raw:e.target.value}))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none">
              <option value="">All Types</option>
              <option value="false">Finished Products</option>
              <option value="true">Raw Materials</option>
            </select>
            <input
              type="file"
              id="excel-import-file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('excel-import-file')?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-md border border-border bg-background hover:bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet size={16}/>
              {importing ? 'Importing...' : 'Import Excel'}
            </button>
            <button onClick={()=>{ setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
              <Plus size={16}/>Add Product
            </button>
          </div>
        }>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['SKU / Code','Product Name','Category','Size','Unit','Purchase Price','Sale Price','Min Stock',''].map(h=>(
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p=>{
              const totalStock = p.stock?.reduce((s:number,st:any)=>s+Number(st.quantity),0)??0;
              const isLow = totalStock<=Number(p.minimumStock)&&Number(p.minimumStock)>0;
              return(
                <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/40 ${isLow?'bg-amber-50/30 dark:bg-amber-900/10':''}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-bold">{p.sku}</p>
                    <p className="text-xs text-muted-foreground">{p.productCode}</p>
                    {p.barcode && <p className="text-xs text-muted-foreground">{p.barcode}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                    {p.isRawMaterial && <span className="text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5">Raw Material</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">{p.category?.name??'—'}</td>
                  <td className="px-4 py-3">{p.size??'—'}</td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="px-4 py-3">{PKR(p.purchasePrice)}</td>
                  <td className="px-4 py-3 font-medium">{PKR(p.salePrice)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${isLow?'text-amber-600':''}`}>
                      {isLow && <AlertTriangle size={11} className="inline mr-1"/>}
                      {Number(p.minimumStock).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={()=>router.push(`/dashboard/products/${p.id}/ledger`)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        <BookOpen size={11}/>Ledger
                      </button>
                      <button onClick={()=>{ setEditing(p); setShowForm(true); }}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        <Pencil size={11}/>Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage}/>
      </DataTableShell>
    </>
  );
}
