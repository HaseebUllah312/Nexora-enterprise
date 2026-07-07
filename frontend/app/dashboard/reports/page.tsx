'use client';
import { useState } from 'react';
import { FileText, Download, Loader2, BarChart2, Package, ShoppingBag, Factory, Users, Printer } from 'lucide-react';
import { api } from '@/lib/api';

const API = typeof window !== 'undefined'
  ? ((window as any).electronAPI?.isDesktop 
      ? 'http://localhost:4000/api/v1' 
      : (process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api/v1`))
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');

const REPORTS = [
  {
    id: 'daily-sales',
    label: 'Daily Sales Report',
    icon: BarChart2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    params: [{ key: 'date', label: 'Date', type: 'date' }],
  },
  {
    id: 'monthly-sales',
    label: 'Monthly Sales Report',
    icon: BarChart2,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    params: [
      { key: 'year',  label: 'Year',  type: 'number', placeholder: new Date().getFullYear().toString() },
      { key: 'month', label: 'Month', type: 'number', placeholder: (new Date().getMonth()+1).toString() },
    ],
  },
  {
    id: 'stock',
    label: 'Inventory / Stock Report',
    icon: Package,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    params: [],
  },
  {
    id: 'purchases',
    label: 'Purchases Report',
    icon: ShoppingBag,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    params: [
      { key: 'from', label: 'From', type: 'date' },
      { key: 'to',   label: 'To',   type: 'date' },
    ],
  },
  {
    id: 'production',
    label: 'Production Report',
    icon: Factory,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    params: [
      { key: 'from', label: 'From', type: 'date' },
      { key: 'to',   label: 'To',   type: 'date' },
    ],
  },
  {
    id: 'employees',
    label: 'Employee Report',
    icon: Users,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    params: [],
  },
];

function ReportCard({ report }: { report: typeof REPORTS[0] }) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  function buildQuery() {
    const q = new URLSearchParams(params);
    return q.toString() ? '?' + q.toString() : '';
  }

  async function generate() {
    setLoading(true); setData(null);
    try {
      const result = await api.get<any>(`/reports/${report.id}${buildQuery()}`);
      setData(result);
    } finally { setLoading(false); }
  }

  async function downloadCSV() {
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(r => r.startsWith('accessToken='))?.split('=')[1];
      const query = buildQuery();
      const url = `${API}/reports/${report.id}${query ? query + '&format=csv' : '?format=csv'}`;
      
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
      const text = await res.text();
      
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${report.id}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    if (!data) return;
    const reportRows = Object.entries(data)
      .filter(([k, v]) => k !== 'year' && k !== 'month')
      .map(([k, v]) => {
        const formattedKey = k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        let formattedVal = '';
        
        if (typeof v === 'number') {
          const isCurrency = k.toLowerCase().includes('amount') || 
                             k.toLowerCase().includes('payable') || 
                             k.toLowerCase().includes('paid') || 
                             k.toLowerCase().includes('payroll') ||
                             k.toLowerCase().includes('outstanding') ||
                             k.toLowerCase().includes('receivable') ||
                             k.toLowerCase().includes('total');
          formattedVal = isCurrency ? PKR(v) : v.toLocaleString();
        } else if (Array.isArray(v)) {
          if (v.length === 0) {
            formattedVal = '<span style="color: #9ca3af; font-style: italic;">None</span>';
          } else if (typeof v[0] === 'object' && v[0] !== null) {
            // Render a mini styled table for the array of objects!
            const keys = Object.keys(v[0]).filter(key => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && typeof v[0][key] !== 'object');
            const headers = keys.map(key => `<th style="text-align: left; font-size: 10px; padding: 6px 8px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; color: #475569;">${key.replace(/([A-Z])/g, ' $1').trim()}</th>`).join('');
            const rows = v.map((item: any) => {
              const tds = keys.map(key => {
                const val = item[key];
                let displayVal = String(val ?? '—');
                if (typeof val === 'number') {
                  const isCurrency = key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('total') || key.toLowerCase().includes('paid') || key.toLowerCase().includes('receivable');
                  displayVal = isCurrency ? PKR(val) : val.toLocaleString();
                }
                return `<td style="font-size: 10px; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${displayVal}</td>`;
              }).join('');
              return `<tr>${tds}</tr>`;
            }).join('');
            
            formattedVal = `
              <table style="width: 100%; border: 1px solid #cbd5e1; border-collapse: collapse; margin-top: 8px; background: #fff;">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
              </table>
            `;
          } else {
            formattedVal = v.join(', ');
          }
        } else {
          formattedVal = String(v ?? '—');
        }

        const isTable = typeof formattedVal === 'string' && formattedVal.includes('<table');
        if (isTable) {
          return `
            <tr>
              <td colspan="2" style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-weight: bold; color: #1e3a8a; margin-bottom: 4px; font-size: 12px;">${formattedKey}</div>
                ${formattedVal}
              </td>
            </tr>
          `;
        }

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #374151;">${formattedKey}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 500;">${formattedVal}</td>
          </tr>
        `;
      }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.label}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
    .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
    .subtitle { font-size: 13px; color: #4b5563; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e5e7eb; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .footer { margin-top: 50px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${report.label}</div>
    <div class="subtitle">Generated on ${new Date().toLocaleString('en-PK')}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Metric</th>
        <th style="text-align: right; width: 40%;">Value</th>
      </tr>
    </thead>
    <tbody>
      ${reportRows}
    </tbody>
  </table>
  <div class="footer">
    Nexora Enterprise • Developed by HM Nexora
  </div>
</body>
</html>`;

    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, report.label);
    } else {
      const w = window.open('', '_blank');
      if (!w) { alert('Allow popups to print'); return; }
      w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();}<\/script></body></html>'));
      w.document.close();
    }
  }

  const PKR = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-4 ${report.bg}`}>
        <report.icon size={20} className={report.color} />
        <h3 className="font-semibold">{report.label}</h3>
      </div>

      <div className="p-5">
        {report.params.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {report.params.map(p => (
              <div key={p.key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{p.label}</label>
                <input
                  type={p.type}
                  placeholder={(p as any).placeholder}
                  value={params[p.key] ?? ''}
                  onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Generate
          </button>
          {data && (
            <>
              <button onClick={downloadCSV} disabled={loading}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted font-medium transition-colors">
                <Download size={14} /> CSV
              </button>
              <button onClick={printReport} disabled={loading}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted font-medium transition-colors">
                <Printer size={14} /> Print
              </button>
            </>
          )}
        </div>

        {data && (
          <div className="mt-5 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data)
                .filter(([k, v]) => typeof v === 'number' && k !== 'year' && k !== 'month')
                .map(([k, v]) => {
                  const isAmount = k.toLowerCase().includes('amount') || k.toLowerCase().includes('payable') || k.toLowerCase().includes('paid') || k.toLowerCase().includes('payroll') || k.toLowerCase().includes('sales') || k.toLowerCase().includes('purchases') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('expenses') || k.toLowerCase().includes('profit') || k.toLowerCase().includes('receivable') || k.toLowerCase().includes('outstanding');
                  const isPositive = k.toLowerCase().includes('sales') || k.toLowerCase().includes('profit') || k.toLowerCase().includes('income') || k.toLowerCase().includes('paid') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('receivables');
                  const isNegative = k.toLowerCase().includes('expenses') || k.toLowerCase().includes('payroll') || k.toLowerCase().includes('payable') || k.toLowerCase().includes('due') || k.toLowerCase().includes('liability');

                  let dotColor = 'bg-blue-500';
                  if (isPositive) dotColor = 'bg-emerald-500';
                  else if (isNegative) dotColor = 'bg-rose-500';

                  return (
                    <div key={k} className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                      </div>
                      <p className="mt-2 text-xl font-extrabold tracking-tight text-foreground animate-in slide-in-from-bottom-1 duration-300">
                        {isAmount ? PKR(v as number) : (v as number).toLocaleString()}
                      </p>
                      <div className="absolute right-3 bottom-3 opacity-5 pointer-events-none">
                        <BarChart2 size={36} className="text-foreground" />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* List Details (Arrays of Objects) */}
            {Object.entries(data)
              .filter(([k, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object')
              .map(([k, v]) => {
                const list = v as any[];
                const keys = Object.keys(list[0]).filter(key => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && typeof list[0][key] !== 'object');
                return (
                  <div key={k} className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in fade-in duration-300">
                    <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-primary border-b border-border pb-2">
                      {k.replace(/([A-Z])/g, ' $1').trim()} List
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left">
                            {keys.map(key => (
                              <th key={key} className="px-3 py-2 uppercase font-medium text-muted-foreground tracking-wider">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((item, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              {keys.map(key => {
                                const val = item[key];
                                const isAmount = key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('total') || key.toLowerCase().includes('paid') || key.toLowerCase().includes('receivable');
                                return (
                                  <td key={key} className="px-3 py-2 font-medium text-foreground">
                                    {isAmount && typeof val === 'number' ? PKR(val) : String(val ?? '—')}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and export business reports in JSON or CSV</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REPORTS.map(r => <ReportCard key={r.id} report={r} />)}
      </div>
    </div>
  );
}
