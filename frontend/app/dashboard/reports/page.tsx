'use client';
import { useState } from 'react';
import { FileText, Download, Loader2, BarChart2, Package, ShoppingBag, Factory, Users } from 'lucide-react';
import { api } from '@/lib/api';

const API = typeof window !== 'undefined'
  ? `${window.location.origin}/api/v1`
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

  function downloadCSV() {
    const token = document.cookie.split('; ').find(r => r.startsWith('accessToken='))?.split('=')[1];
    const url = `${API}/reports/${report.id}${buildQuery() ? buildQuery() + '&format=csv' : '?format=csv'}`;
    const a = document.createElement('a');
    a.href = url; a.download = `${report.id}-${Date.now()}.csv`; a.click();
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
            <button onClick={downloadCSV}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              <Download size={14} /> CSV
            </button>
          )}
        </div>

        {data && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(data)
              .filter(([k, v]) => typeof v === 'number' && k !== 'year' && k !== 'month')
              .map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground capitalize">
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {k.toLowerCase().includes('amount') || k.toLowerCase().includes('payable') || k.toLowerCase().includes('paid') || k.toLowerCase().includes('payroll')
                      ? PKR(v as number)
                      : (v as number).toLocaleString()}
                  </p>
                </div>
              ))}
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
