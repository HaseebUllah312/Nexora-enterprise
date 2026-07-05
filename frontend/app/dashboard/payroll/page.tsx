'use client';
import { useEffect, useState, useCallback } from 'react';
import { Wallet, Printer, CheckCircle, Play, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Select } from '@/components/ui/form-field';
import { getCurrentUser } from '@/lib/auth';

interface Slip { id:string;slipNo:string;month:number;year:number;basicSalary:string;bonus:string;deductions:string;netSalary:string;status:string;paidOn?:string;employee:{name:string;designation?:string;branch:{name:string}}; }
const PKR=(v:string|number)=>'PKR '+Number(v).toLocaleString('en-PK',{maximumFractionDigits:0});
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const user = getCurrentUser();
  const now = new Date();
  const [slips,    setSlips]    = useState<Slip[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string|null>(null);
  const [month,    setMonth]    = useState(now.getMonth()+1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [generating,setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSlips(await api.get<Slip[]>(`/employees/payroll/slips?month=${month}&year=${year}`)); }
    catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(()=>{ load(); },[load]);

  async function generate() {
    setGenerating(true);
    try {
      await api.post('/employees/payroll/bulk-generate', { branchId: user?.branch?.id, month, year });
      load();
    } catch (e:any) { alert(e.message); }
    finally { setGenerating(false); }
  }

  async function markPaid(id:string) {
    try { await api.patch(`/employees/salary-slip/${id}/paid`); load(); } catch (e:any) { alert(e.message); }
  }

  function printSlip(s:Slip) {
    const html = `<!DOCTYPE html><html><head><title>${s.slipNo}</title>
      <style>body{font-family:Arial,sans-serif;font-size:13px;margin:20mm}table{width:100%;border-collapse:collapse}</style></head>
      <body>
      <div style="border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px">SALARY SLIP</h1>
        <p style="margin:4px 0;color:#555">${MONTHS[s.month-1]} ${s.year}</p>
      </div>
      <table style="margin-bottom:20px">
        <tr><td style="padding:4px 0;color:#555">Employee</td><td style="padding:4px 0;font-weight:bold;text-align:right">${s.employee.name}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Designation</td><td style="padding:4px 0;text-align:right">${s.employee.designation??'—'}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Branch</td><td style="padding:4px 0;text-align:right">${s.employee.branch.name}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Slip No</td><td style="padding:4px 0;text-align:right">${s.slipNo}</td></tr>
      </table>
      <table style="border-top:1px solid #e2e8f0;padding-top:10px">
        <tr><td style="padding:6px 0">Basic Salary</td><td style="padding:6px 0;text-align:right">${PKR(s.basicSalary)}</td></tr>
        <tr><td style="padding:6px 0;color:#16a34a">Bonus</td><td style="padding:6px 0;text-align:right;color:#16a34a">+ ${PKR(s.bonus)}</td></tr>
        <tr><td style="padding:6px 0;color:#dc2626">Deductions</td><td style="padding:6px 0;text-align:right;color:#dc2626">- ${PKR(s.deductions)}</td></tr>
        <tr style="border-top:2px solid #000;font-size:16px;font-weight:bold"><td style="padding:10px 0">Net Salary</td><td style="padding:10px 0;text-align:right">${PKR(s.netSalary)}</td></tr>
      </table>
      <p style="margin-top:30px;color:${s.status==='PAID'?'#16a34a':'#dc2626'};font-weight:bold">Status: ${s.status}</p>
      <div style="margin-top:40px;border-top:1px solid #000;width:200px;padding-top:6px;text-align:center;font-size:11px;color:#555">Employee Signature</div>
      </body></html>`;

    // ── Electron Check ──────────────────────────────────────────────────────────
    const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
    if (electronAPI?.printHTML) {
      electronAPI.printHTML(html, `Salary Slip — ${s.slipNo}`);
      return;
    }

    // ── Browser Fallback ────────────────────────────────────────────────────────
    const w = window.open('','_blank'); if(!w) return;
    w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();window.close();}<\/script></body></html>'));
    w.document.close();
  }

  const totalPayroll = slips.reduce((s,x)=>s+Number(x.netSalary),0);
  const paidCount = slips.filter(s=>s.status==='PAID').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Generate and manage monthly salary slips</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month.toString()} onChange={e=>setMonth(Number(e.target.value))} className="w-36">
            {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </Select>
          <Select value={year.toString()} onChange={e=>setYear(Number(e.target.value))} className="w-24">
            {[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </div>

      {slips.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Payroll</p>
            <p className="text-2xl font-bold mt-1">{PKR(totalPayroll)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Employees</p>
            <p className="text-2xl font-bold mt-1">{slips.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid / Pending</p>
            <p className="text-2xl font-bold mt-1"><span className="text-emerald-600">{paidCount}</span> / <span className="text-amber-600">{slips.length-paidCount}</span></p>
          </div>
        </div>
      )}

      <DataTableShell title={`Salary Slips — ${MONTHS[month-1]} ${year}`} description="Generate slips for all employees, then mark as paid once processed"
        loading={loading} error={error} empty={slips.length===0}
        emptyLabel={`No salary slips for ${MONTHS[month-1]} ${year} yet.`}
        action={
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm disabled:opacity-50">
            <Play size={15}/>{generating?'Generating...':'Generate Payroll'}
          </button>
        }>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Employee','Designation','Branch','Basic','Bonus','Deductions','Net Salary','Status','Actions'].map(h=>(
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr></thead>
          <tbody>{slips.map(s=>(
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-semibold">{s.employee.name}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{s.employee.designation??'—'}</td>
              <td className="px-4 py-3">{s.employee.branch.name}</td>
              <td className="px-4 py-3">{PKR(s.basicSalary)}</td>
              <td className="px-4 py-3 text-emerald-600">{Number(s.bonus)>0?'+'+PKR(s.bonus):'—'}</td>
              <td className="px-4 py-3 text-red-500">{Number(s.deductions)>0?'-'+PKR(s.deductions):'—'}</td>
              <td className="px-4 py-3 font-bold">{PKR(s.netSalary)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status==='PAID'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                  {s.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  <button onClick={()=>printSlip(s)} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted"><Printer size={11}/>Print</button>
                  {s.status==='PENDING' && (
                    <button onClick={()=>markPaid(s.id)} className="flex items-center gap-1 rounded border border-emerald-300 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50"><CheckCircle size={11}/>Mark Paid</button>
                  )}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
