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

        const normalizeHeader = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const headerCandidates = [
          ['productname', 'name', 'itemname'],
          ['itemcode', 'productcode', 'code', 'sku', 'barcode'],
          ['purchaseprice', 'purchase', 'buyprice', 'cost'],
          ['saleprice', 'sale', 'sellingprice', 'price'],
          ['group', 'category', 'groupname', 'categoryname'],
        ];

        const headerMatches = (header: string, candidate: string) => {
          const normalizedHeader = normalizeHeader(header);
          const normalizedCandidate = normalizeHeader(candidate);
          return normalizedHeader.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHeader);
        };

        const scoreHeaderRow = (row: any[]) => {
          const normalizedRow = row.map(cell => normalizeHeader(String(cell || '')));
          return headerCandidates.reduce((score, group) => {
            return score + (group.some(candidate => normalizedRow.some(cell => headerMatches(cell, candidate))) ? 1 : 0);
          }, 0);
        };

        const headerRowIndex = data.slice(0, Math.min(data.length, 5)).reduce((best, row, index) => {
          const score = scoreHeaderRow(row);
          return score > best.score ? { index, score } : best;
        }, { index: 0, score: 0 }).index;

        const headers = data[headerRowIndex].map(h => String(h || '').trim());
        const rows = data.slice(headerRowIndex + 1);

        const getVal = (row: any[], candidates: string[]) => {
          const normalizedCandidates = candidates.map(normalizeHeader);
          const index = headers.findIndex((header) => {
            const normalizedHeader = normalizeHeader(header);
            return normalizedCandidates.some(candidate =>
              normalizedHeader.includes(candidate) || candidate.includes(normalizedHeader)
            );
          });
          return index !== -1 ? row[index] : undefined;
        };

        const mappedProducts = rows.map((row, rowIndex) => {
          const fallbackCode = `AUTO-${String(rowIndex + 2).padStart(4, '0')}`;
          const productCode = String(getVal(row, ['itemcode', 'productcode', 'code', 'sku']) || fallbackCode).trim();
          const name = String(getVal(row, ['productname', 'name', 'itemname']) || '').trim();
          const unit = String(getVal(row, ['unit', 'uom', 'measure']) || 'PCS').trim();
          const openingStock = Number(getVal(row, ['openingstock', 'openingstockqty', 'stock']) || 0);
          const purchasePrice = Number(getVal(row, ['purchaseprice', 'purchase', 'buyprice', 'cost']) || 0);
          const salePrice = Number(getVal(row, ['saleprice', 'sale', 'sellingprice', 'price']) || 0);
          const minimumStock = Number(getVal(row, ['minimumstock', 'minstock', 'reorderlevel']) || 0);
          const categoryName = String(getVal(row, ['group', 'category', 'categoryname', 'groupname']) || '').trim();
          const brand = getVal(row, ['brand', 'brandname']) ? String(getVal(row, ['brand', 'brandname'])).trim() : null;
          const barcode = getVal(row, ['barcode', 'barcodeno']) ? String(getVal(row, ['barcode', 'barcodeno'])).trim() : null;
          const size = getVal(row, ['size', 'dimension', 'sizes']) ? String(getVal(row, ['size', 'dimension', 'sizes'])).trim() : null;
          const isRawMaterial = String(getVal(row, ['rawmaterial', 'type']) || '').toLowerCase().includes('raw');

          return {
            categoryName,
            brand,
            productCode,
            sku: String(getVal(row, ['sku', 'itemcode', 'productcode', 'code']) || productCode).trim(),
            name,
            unit,
            openingStock,
            purchasePrice,
            salePrice,
            minimumStock,
            barcode,
            size,
            isRawMaterial,
          };
        }).filter(p => p.name);

        if (mappedProducts.length === 0) {
          alert('No valid products found to import. Please check column headers (e.g. Product Name, Item Code, Sale Price, Group).');
          setImporting(false);
          return;
        }

        if (confirm(`Are you sure you want to import ${mappedProducts.length} products?`)) {
          const res = await api.post<{ success: boolean; count: number; errorCount?: number; errors?: any[] }>('/products/import', { products: mappedProducts });
          if (res.success) {
            let msg = `Successfully imported/updated ${res.count} products!`;
            if (res.errorCount && res.errorCount > 0) {
              msg += `\n\n⚠️ ${res.errorCount} rows failed (e.g. duplicate codes or missing fields).`;
              if (res.errors && res.errors.length > 0) {
                msg += '\n\nFirst failed rows:\n' + res.errors.slice(0, 5).map((e: any) => `Row ${e.row}: ${e.reason}`).join('\n');
              }
            }
            alert(msg);
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
