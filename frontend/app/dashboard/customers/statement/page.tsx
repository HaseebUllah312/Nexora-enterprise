'use client';
import { useEffect, useState } from 'react';
import { Printer, Search, FileText } from 'lucide-react';
import { api } from '@/lib/api';

interface Customer { id:string; name:string; phone?:string; balance:string; branch:{name:string}; }
interface StatRow { date:string; invoiceNo:string; orderNo:string; totalAmount:number; paidAmount:number; outstanding:number; runningBalance:number; }
interface Statement { customer: Customer; entries: StatRow[]; totalOutstanding: number; }

const PKR = (v:number) => 'PKR '+v.toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function CustomerStatementPage() {
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [search,     setSearch]     = useState('');
  const [customerId, setCustomerId] = useState('');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [statement,  setStatement]  = useState<Statement|null>(null);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    api.get<Customer[]>('/customers').then(setCustomers).catch(()=>{});
  },[]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone??'').includes(search)
  );

  async function loadStatement() {
    if (!customerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      setStatement(await api.get<Statement>(`/sales/customer-statement/${customerId}?${params}`));
    } catch (e:any) { alert(e.message); }
    finally { setLoading(false); }
  }

  function printStatement() {
    if (!statement) return;
    const rows = statement.entries.map((r,i) => `
      <tr style="background:${i%2?'#f8fafc':'#fff'}">
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${new Date(r.date).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-weight:500">${r.invoiceNo}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${PKR(r.totalAmount)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#16a34a">${PKR(r.paidAmount)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:${r.outstanding>0?'#dc2626':'#16a34a'}">${PKR(r.outstanding)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;color:${r.runningBalance>0?'#dc2626':'#16a34a'}">${PKR(r.runningBalance)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Statement — ${statement.customer.name}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:15mm}table{width:100%;border-collapse:collapse}</style></head>
      <body>
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:20px">
        <div><h1 style="margin:0;font-size:20px">Nexora Enterprise</h1></div>
        <div style="text-align:right"><h2 style="margin:0;font-size:18px;color:#2563eb">ACCOUNT STATEMENT</h2>
          ${from||to?`<p style="margin:4px 0;color:#555">Period: ${from?new Date(from).toLocaleDateString('en-PK'):'Start'} — ${to?new Date(to).toLocaleDateString('en-PK'):'Today'}</p>`:'<p style="margin:4px 0;color:#555">All Transactions</p>'}
          <p style="margin:2px 0;color:#555">Printed: ${new Date().toLocaleDateString('en-PK')}</p></div>
      </div>
      <div style="margin-bottom:20px">
        <p style="font-size:10px;font-weight:bold;text-transform:uppercase;color:#555;letter-spacing:1px;margin:0 0 4px">Customer</p>
        <p style="font-size:16px;font-weight:bold;margin:0">${statement.customer.name}</p>
        ${statement.customer.phone?`<p style="margin:2px 0;color:#555">${statement.customer.phone}</p>`:''}
        <p style="margin:2px 0;color:#555">${statement.customer.branch.name}</p>
      </div>
      <table><thead><tr style="background:#1d4ed8;color:white">
        <th style="padding:8px 10px;text-align:left">Date</th>
        <th style="padding:8px 10px;text-align:left">Invoice #</th>
        <th style="padding:8px 10px;text-align:right">Invoice Amt</th>
        <th style="padding:8px 10px;text-align:right">Paid</th>
        <th style="padding:8px 10px;text-align:right">Outstanding</th>
        <th style="padding:8px 10px;text-align:right">Balance</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr style="background:#1e293b;color:white">
        <td colspan="4" style="padding:10px">Total Outstanding Balance</td>
        <td colspan="2" style="padding:10px;text-align:right;font-size:16px;font-weight:bold">${PKR(statement.totalOutstanding)}</td>
      </tr></tfoot></table>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, `Statement — ${statement.customer.name}`);
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.print();window.close();<\/script></body></html>'));
    w.document.close();
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Customer Statement</h1>
        <p className="text-sm text-muted-foreground">Full transaction history and outstanding balance for any customer</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Customer</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer name or phone..."
                className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
            </div>
            {search && filtered.length > 0 && (
              <div className="rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                {filtered.map(c=>(
                  <button key={c.id} onClick={()=>{ setCustomerId(c.id); setSearch(c.name); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/60 border-b border-border last:border-0 ${customerId===c.id?'bg-primary/5':''}`}>
                    <div className="text-left">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone} · {c.branch.name}</p>
                    </div>
                    {Number(c.balance)>0 && <span className="text-xs text-red-500 font-medium ml-2">{PKR(Number(c.balance))}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">From Date</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">To Date</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={loadStatement} disabled={!customerId||loading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <FileText size={15}/>{loading?'Loading...':'Generate Statement'}
          </button>
          {statement && (
            <button onClick={printStatement}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted font-medium">
              <Printer size={15}/>Print Statement
            </button>
          )}
        </div>
      </div>

      {statement && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
            <div>
              <h2 className="font-bold text-lg">{statement.customer.name}</h2>
              <p className="text-sm text-muted-foreground">{statement.customer.phone} · {statement.customer.branch.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Outstanding</p>
              <p className={`text-2xl font-bold ${statement.totalOutstanding>0?'text-red-500':'text-emerald-600'}`}>
                {PKR(statement.totalOutstanding)}
              </p>
            </div>
          </div>

          {statement.entries.length===0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No transactions found for this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                {['Date','Invoice #','Order #','Invoice Amt','Paid','Outstanding','Running Balance'].map(h=>(
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {statement.entries.map((r,i)=>(
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.date).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.invoiceNo}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.orderNo}</td>
                    <td className="px-4 py-3 font-medium">{PKR(r.totalAmount)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{PKR(r.paidAmount)}</td>
                    <td className={`px-4 py-3 font-medium ${r.outstanding>0?'text-red-500':''}`}>{PKR(r.outstanding)}</td>
                    <td className={`px-4 py-3 font-bold ${r.runningBalance>0?'text-red-500':'text-emerald-600'}`}>{PKR(r.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t-2 border-border">
                  <td colSpan={6} className="px-4 py-3 font-bold text-right">Total Outstanding Balance</td>
                  <td className={`px-4 py-3 font-bold text-lg ${statement.totalOutstanding>0?'text-red-500':'text-emerald-600'}`}>
                    {PKR(statement.totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
