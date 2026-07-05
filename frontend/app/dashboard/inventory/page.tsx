'use client';
import { useEffect, useState, useCallback } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Truck, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { StockMovementForm } from '@/components/forms/stock-in-form';
import { TransferForm } from '@/components/forms/transfer-form';
import { Pagination } from '@/components/ui/pagination';

interface StockRow { id:string;productId:string;quantity:string;batchNumber?:string;product:{name:string;sku:string;unit:string;minimumStock:string};warehouse:{name:string};branch:{name:string}; }
interface Transfer { id:string;transferNo:string;status:string;requestedAt:string;fromBranch:{name:string};toBranch:{name:string};items:any[]; }
const ST:Record<string,string>={REQUESTED:'bg-amber-100 text-amber-700',APPROVED:'bg-blue-100 text-blue-700',DISPATCHED:'bg-purple-100 text-purple-700',IN_TRANSIT:'bg-purple-100 text-purple-700',RECEIVED:'bg-emerald-100 text-emerald-700',REJECTED:'bg-red-100 text-red-700'};

export default function InventoryPage() {
  const [tab,setTab]=useState<'stock'|'transfers'>('stock');
  const [stock,setStock]=useState<StockRow[]>([]);
  const [transfers,setTransfers]=useState<Transfer[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [modal,setModal]=useState<'in'|'out'|'adjust'|null>(null);
  const [showTransfer,setShowTransfer]=useState(false);
  const [page,setPage]=useState(1);
  const [selectedProduct,setSelectedProduct]=useState<{id:string;name:string}|null>(null);
  const PAGE_SIZE=30;

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      if(tab==='stock') setStock(await api.get<StockRow[]>('/inventory/stock'));
      else setTransfers(await api.get<Transfer[]>('/inventory/transfers'));
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[tab]);

  useEffect(()=>{setPage(1);},[tab]);
  useEffect(()=>{load();},[load]);

  async function advance(id:string,action:string){
    try{await api.patch(`/inventory/transfers/${id}/${action}`);load();}catch(e:any){alert(e.message);}
  }

  const lowCount=stock.filter(s=>Number(s.quantity)<=Number(s.product.minimumStock)).length;

  return(
    <>
      {modal&&<StockMovementForm open mode={modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load();}}/>}
      <TransferForm open={showTransfer} onClose={()=>setShowTransfer(false)} onSaved={()=>{setShowTransfer(false);setTab('transfers');load();}}/>

      <DataTableShell title="Inventory" description="Stock levels, movements and branch transfers"
        loading={loading} error={error}
        empty={tab==='stock'?stock.length===0:transfers.length===0}
        emptyLabel={tab==='stock'?'No stock recorded yet.':'No transfers yet.'}
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setModal('in')} className="flex items-center gap-1.5 rounded-md border border-emerald-400 text-emerald-700 dark:text-emerald-400 px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 font-medium">
              <ArrowDownToLine size={15}/>Stock In
            </button>
            <button onClick={()=>setModal('out')} className="flex items-center gap-1.5 rounded-md border border-red-400 text-red-600 dark:text-red-400 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 font-medium">
              <ArrowUpFromLine size={15}/>Stock Out
            </button>
            <button onClick={()=>setModal('adjust')} className="flex items-center gap-1.5 rounded-md border border-amber-400 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium">
              <SlidersHorizontal size={15}/>Adjust
            </button>
            <button onClick={()=>setShowTransfer(true)} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Truck size={15}/>New Transfer
            </button>
          </div>
        }>
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          {(['stock','transfers'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab===t?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted'}`}>
              {t==='stock'?`Stock${lowCount>0?` (${lowCount} low)`:''}`:' Transfers'}
            </button>
          ))}
          <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw size={13}/>Refresh
          </button>
        </div>

        {tab==='stock'&&(
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Product','SKU','Branch','Warehouse','Batch','Quantity','Status'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{stock.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(s=>{
              const qty=Number(s.quantity),min=Number(s.product.minimumStock),low=qty<=min;
              return(
                <tr key={s.id} className={`border-b border-border last:border-0 ${low?'bg-red-50/40 dark:bg-red-900/10':'hover:bg-muted/40'}`}>
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={()=>setSelectedProduct({id:s.productId,name:s.product.name})}
                      className="text-primary hover:underline text-left font-semibold"
                    >
                      {s.product.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.product.sku}</td>
                  <td className="px-4 py-3">{s.branch.name}</td>
                  <td className="px-4 py-3">{s.warehouse.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.batchNumber||'—'}</td>
                  <td className={`px-4 py-3 font-semibold ${low?'text-red-500':''}`}>{qty.toLocaleString()} {s.product.unit}</td>
                  <td className="px-4 py-3">
                    {low
                      ?<span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium dark:bg-red-900/30 dark:text-red-400">Low — min {min}</span>
                      :<span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs dark:bg-emerald-900/30 dark:text-emerald-400">OK</span>
                    }
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}

        {tab==='transfers'&&(
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Transfer #','From','To','Items','Status','Date','Actions'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{transfers.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(t=>(
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{t.transferNo}</td>
                <td className="px-4 py-3">{t.fromBranch.name}</td>
                <td className="px-4 py-3">{t.toBranch.name}</td>
                <td className="px-4 py-3">{(t.items as any[]).length}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ST[t.status]||''}`}>{t.status.replace('_',' ')}</span></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(t.requestedAt).toLocaleDateString('en-PK')}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {t.status==='REQUESTED'&&<>
                      <ActionBtn label="Approve"  color="blue"   onClick={()=>advance(t.id,'approve')}/>
                      <ActionBtn label="Reject"   color="red"    onClick={()=>advance(t.id,'reject')}/>
                    </>}
                    {t.status==='APPROVED'&&   <ActionBtn label="Dispatch" color="purple" onClick={()=>advance(t.id,'dispatch')}/>}
                    {(t.status==='DISPATCHED'||t.status==='IN_TRANSIT')&&<ActionBtn label="Receive" color="green" onClick={()=>advance(t.id,'receive')}/>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={tab==='stock'?stock.length:transfers.length} onChange={setPage}/>
      </DataTableShell>

      {selectedProduct && (
        <ProductLedgerModal
          open={!!selectedProduct}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}

function ActionBtn({label,onClick,color}:{label:string;onClick:()=>void;color:string}){
  const c:Record<string,string>={blue:'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400',purple:'border-purple-300 text-purple-700 hover:bg-purple-50',green:'border-emerald-300 text-emerald-700 hover:bg-emerald-50',red:'border-red-300 text-red-600 hover:bg-red-50'};
  return <button onClick={onClick} className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${c[color]||''}`}>{label}</button>;
}

interface Movement {
  id: string;
  type: string;
  quantity: string;
  notes: string | null;
  createdAt: string;
}

function ProductLedgerModal({
  open,
  productId,
  productName,
  onClose,
}: {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) return;
    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Movement[]>(`/inventory/movements?productId=${productId}`);
        setMovements(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [open, productId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-xl border border-border bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Product Ledger / Stock History</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Showing stock movements for <span className="font-semibold text-primary">{productName}</span></p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="overflow-y-auto max-h-[60vh] rounded-md border border-border">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <RefreshCw className="animate-spin mr-2" size={18} /> Loading history...
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground text-sm">
              No stock movements found for this product.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty Change</th>
                  <th className="px-4 py-3">Reference / Description</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const qty = Number(m.quantity);
                  const isPositive = qty > 0;
                  const typeColors: Record<string, string> = {
                    STOCK_IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
                    STOCK_OUT: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                    TRANSFER: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
                    ADJUSTMENT: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                    PRODUCTION_CONSUMPTION: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
                    PRODUCTION_OUTPUT: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
                    SALE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
                    PURCHASE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
                  };
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString('en-PK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeColors[m.type] || 'bg-muted text-muted-foreground'}`}>
                          {m.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}
                        {qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="rounded-md border bg-muted/50 hover:bg-muted px-4 py-2 text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
