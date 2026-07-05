'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Calendar, ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { EmployeeForm } from '@/components/forms/employee-form';
import { AttendanceForm } from '@/components/forms/attendance-form';
import { Modal } from '@/components/ui/modal';

interface Employee { id:string;name:string;designation?:string;salary:string;joinDate?:string;branch:{name:string};user?:{email:string}|null; }
interface AttRow { date:string;status:string;checkIn?:string;checkOut?:string; }
const ATT_STYLE:Record<string,string>={PRESENT:'bg-emerald-100 text-emerald-700',ABSENT:'bg-red-100 text-red-700',LEAVE:'bg-blue-100 text-blue-700',HALF_DAY:'bg-amber-100 text-amber-700'};

export default function EmployeesPage() {
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [showAdd,setShowAdd]=useState(false);
  const [showAtt,setShowAtt]=useState(false);
  const [attEmployee,setAttEmployee]=useState<Employee|null>(null);
  const [attSummary,setAttSummary]=useState<any>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{setEmployees(await api.get<Employee[]>('/employees'));}
    catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  async function openAtt(e:Employee){
    setAttEmployee(e);
    const now=new Date();
    const data=await api.get<any>(`/employees/${e.id}/attendance-summary?year=${now.getFullYear()}&month=${now.getMonth()+1}`).catch(()=>null);
    setAttSummary(data);
  }

  return(
    <>
      <EmployeeForm  open={showAdd} onClose={()=>setShowAdd(false)} onSaved={load}/>
      <AttendanceForm open={showAtt} onClose={()=>setShowAtt(false)} onSaved={load}/>

      <Modal open={!!attEmployee} onClose={()=>setAttEmployee(null)}
        title={`Attendance — ${attEmployee?.name}`}
        subtitle={`${new Date().toLocaleString('default',{month:'long'})} ${new Date().getFullYear()}`}
        width="max-w-md">
        {attSummary?(
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3">
              {[['Present',attSummary.present,'text-emerald-600'],['Absent',attSummary.absent,'text-red-500'],
                ['Leave',attSummary.leave,'text-blue-600'],['Half Day',attSummary.halfDay,'text-amber-600']].map(([k,v,c])=>(
                <div key={k as string} className="rounded-lg border border-border p-3 text-center">
                  <p className={`text-2xl font-bold ${c}`}>{v as number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k as string}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {attSummary.records?.slice(0,15).map((r:AttRow)=>(
                <div key={r.date} className="flex items-center justify-between px-4 py-2 text-sm border-b border-border last:border-0">
                  <span className="text-muted-foreground">{new Date(r.date).toLocaleDateString('en-PK',{weekday:'short',day:'numeric',month:'short'})}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATT_STYLE[r.status]||''}`}>{r.status.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ):<p className="text-sm text-muted-foreground text-center py-8">No attendance records this month.</p>}
      </Modal>

      <DataTableShell title="Employees" description="Employee records, attendance and payroll"
        loading={loading} error={error} empty={employees.length===0} emptyLabel="No employees yet."
        action={
          <div className="flex gap-2">
            <button onClick={()=>setShowAtt(true)}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium">
              <ClipboardCheck size={15}/>Mark Attendance
            </button>
            <button onClick={()=>setShowAdd(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
              <Plus size={16}/>Add Employee
            </button>
          </div>
        }>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {['Name','Designation','Branch','Email','Salary','Join Date',''].map(h=><th key={h} className="px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>{employees.map(e=>(
            <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3 font-medium">{e.name}</td>
              <td className="px-4 py-3">{e.designation||'—'}</td>
              <td className="px-4 py-3">{e.branch.name}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{e.user?.email||'—'}</td>
              <td className="px-4 py-3">PKR {Number(e.salary).toLocaleString()}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{e.joinDate?new Date(e.joinDate).toLocaleDateString('en-PK'):'—'}</td>
              <td className="px-4 py-3">
                <button onClick={()=>openAtt(e)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                  <Calendar size={11}/>Attendance
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </DataTableShell>
    </>
  );
}
