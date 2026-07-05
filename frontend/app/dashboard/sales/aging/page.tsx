'use client';
import { useEffect, useState, useCallback } from 'react';
import { Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface AgingRow { customer:string; invoiceNo:string; invoiceDate:string; daysOld:number; outstanding:number; bucket:string; }
interface AgingReport { rows:AgingRow[]; buckets:{current:number;days30:number;days60:number;days90:number;over90:number}; total:number; }

const PKR = (v:number) => 'PKR '+v.toLocaleString('en-PK',{maximumFractionDigits:0});
const BUCKET_STYLE:Record<string,string> = {
  'Current':'bg-emerald-100 text-emerald-700','31-60':'bg-yellow-100 text-yellow-700',
  '61-90':'bg-orange-100 text-orange-700','91-120':'bg-red-100 text-red-700','120+':'bg-red-200 text-red-800',
};

export default function AgingReportPage() {
  const [report,  setReport]  = useState<AgingReport|null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async()=>{
    setLoading(true);
    try { setReport(await api.get<AgingReport>('/sales/aging')); }
    catch {}
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  function printReport() {
    if (!report) return;
    const rows = (report.rows as AgingRow[]).map((r,i)=>`
      <tr style="background:${i%2?'#f8fafc':'#fff'}">
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${r.customer}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${r.invoiceNo}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${new Date(r.invoiceDate).toLocaleDateString('en-PK')}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:${r.daysOld>90?'#dc2626':'#374151'}">${r.daysOld} days</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${r.bucket}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;color:#dc2626">${PKR(r.outstanding)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Aging Report</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:15mm}table{width:100%;border-collapse:collapse}</style></head>
      <body>
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px">
        <div><h1 style="margin:0;font-size:20px">Nexora Enterprise</h1></div>
        <div style="text-align:right"><h2 style="margin:0;font-size:18px;color:#dc2626">RECEIVABLES AGING</h2>
          <p style="margin:2px 0;color:#555">As of: ${new Date().toLocaleDateString('en-PK')}</p></div>
      </div>
      <div style="display:flex;gap:20px;margin-bottom:20px">
        ${Object.entries({Current:report.buckets.current,'31-60':report.buckets.days30,'61-90':report.buckets.days60,'91-120':report.buckets.days90,'120+':report.buckets.over90})
          .map(([k,v])=>`<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;min-width:100px;text-align:center">
            <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase">${k}</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:bold;color:${v>0?'#dc2626':'#16a34a'}">${PKR(v)}</p>
          </div>`).join('')}
      </div>
      <table><thead><tr style="background:#1d4ed8;color:white">
        <th style="padding:8px 10px;text-align:left">Customer</th>
        <th style="padding:8px 10px;text-align:left">Invoice #</th>
        <th style="padding:8px 10px;text-align:left">Date</th>
        <th style="padding:8px 10px;text-align:center">Age</th>
        <th style="padding:8px 10px;text-align:center">Bucket</th>
        <th style="padding:8px 10px;text-align:right">Outstanding</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr style="background:#1e293b;color:white">
        <td colspan="5" style="padding:10px">Total Receivables</td>
        <td style="padding:10px;text-align:right;font-size:16px;font-weight:bold">${PKR(report.total)}</td>
      </tr></tfoot></table>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, 'Receivables Aging Report');
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();window.close();}<\/script></body></html>'));
    w.document.close();
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receivables Aging</h1>
          <p className="text-sm text-muted-foreground">Outstanding invoices grouped by how overdue they are</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            <RefreshCw size={14}/>Refresh
          </button>
          {report && (
            <button onClick={printReport} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium">
              <Printer size={14}/>Print
            </button>
          )}
        </div>
      </div>

      {loading && <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">Loading aging report...</div>}

      {report && (
        <>
          {/* Bucket summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([
              ['Current (0-30 days)', report.buckets.current,    'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'],
              ['31-60 days',          report.buckets.days30,     'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'],
              ['61-90 days',          report.buckets.days60,     'text-orange-700 bg-orange-50 dark:bg-orange-900/20'],
              ['91-120 days',         report.buckets.days90,     'text-red-600 bg-red-50 dark:bg-red-900/20'],
              ['Over 120 days',       report.buckets.over90,     'text-red-800 bg-red-100 dark:bg-red-900/30'],
            ] as [string,number,string][]).map(([label,amount,style])=>(
              <div key={label} className={`rounded-lg border border-border p-4 ${style}`}>
                <p className="text-xs font-medium opacity-70">{label}</p>
                <p className="text-xl font-bold mt-1">{PKR(amount)}</p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 px-5 py-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle size={16}/>
              <span className="font-semibold">Total Receivables Outstanding</span>
            </div>
            <span className="text-2xl font-bold text-red-700 dark:text-red-400">{PKR(report.total)}</span>
          </div>

          {/* Detail table */}
          {report.rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
              No outstanding receivables. All invoices are fully paid!
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  {['Customer','Invoice #','Invoice Date','Days Old','Bucket','Outstanding'].map(h=>(
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(report.rows as AgingRow[]).map((r,i)=>(
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{r.customer}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{r.invoiceNo}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.invoiceDate).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td className={`px-4 py-3 font-semibold ${r.daysOld>90?'text-red-500':r.daysOld>60?'text-orange-500':'text-muted-foreground'}`}>{r.daysOld}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUCKET_STYLE[r.bucket]||''}`}>{r.bucket}</span></td>
                      <td className="px-4 py-3 font-bold text-red-600">{PKR(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
