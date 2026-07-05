'use client';
import { useEffect, useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { AccountForm, JournalEntryForm } from '@/components/forms/journal-form';

type Tab='trial-balance'|'pnl'|'balance-sheet'|'cashbook'|'accounts';
const PKR = (v: any) => {
  const val = Number(v);
  return 'PKR ' + (isNaN(val) ? '0' : val.toLocaleString('en-PK', { maximumFractionDigits: 0 }));
};

export default function AccountingPage() {
  const [tab,setTab]=useState<Tab>('trial-balance');
  const [data,setData]=useState<any>(null);
  const [accounts,setAccounts]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [showAcc,setShowAcc]=useState(false);
  const [showJnl,setShowJnl]=useState(false);

  useEffect(()=>{ load(); },[tab]);

  async function load(){
    setLoading(true);setData(null);
    try{
      if(tab==='accounts'){
        setAccounts(await api.get<any[]>('/accounting/accounts'));
      } else {
        const endpoints:Record<Tab,string>={
          'trial-balance':'/accounting/reports/trial-balance',
          'pnl':'/accounting/reports/profit-and-loss',
          'balance-sheet':'/accounting/reports/balance-sheet',
          'cashbook':'/accounting/reports/cash-book',
          'accounts':'',
        };
        setData(await api.get(endpoints[tab]));
      }
    }catch{}finally{setLoading(false);}
  }

  const TABS=[
    {key:'trial-balance',label:'Trial Balance'},
    {key:'pnl',label:'Profit & Loss'},
    {key:'balance-sheet',label:'Balance Sheet'},
    {key:'cashbook',label:'Cash Book'},
    {key:'accounts',label:'Chart of Accounts'},
  ];

  return(
    <>
      <AccountForm     open={showAcc} onClose={()=>setShowAcc(false)} onSaved={load}/>
      <JournalEntryForm open={showJnl} onClose={()=>setShowJnl(false)} onSaved={load}/>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold">Accounting</h1><p className="text-sm text-muted-foreground">General ledger and financial reports</p></div>
          <div className="flex gap-2">
            <button onClick={()=>setShowAcc(true)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted font-medium">
              <Plus size={15}/>Add Account
            </button>
            <button onClick={()=>setShowJnl(true)} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <BookOpen size={15}/>Journal Entry
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key as Tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab===t.key?'bg-primary text-primary-foreground':'border border-border hover:bg-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {loading && <p className="text-muted-foreground text-sm">Loading...</p>}

          {/* Trial Balance */}
          {!loading&&data&&tab==='trial-balance'&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Trial Balance</h2>
                <span className={data.isBalanced?'text-emerald-600 text-sm font-medium':'text-red-500 text-sm font-medium'}>
                  {data.isBalanced?'✓ Balanced':'⚠ Out of Balance'}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 px-2">Account</th><th className="py-2 px-2">Type</th><th className="py-2 px-2 text-right">Balance</th>
                </tr></thead>
                <tbody>{data.accounts?.map((a:any)=>(
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{a.name}</td>
                    <td className="py-2 px-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.type}</span></td>
                    <td className={`py-2 px-2 text-right font-semibold ${Number(a.balance)<0?'text-red-500':''}`}>PKR {Number(a.balance).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr className="border-t-2 font-bold bg-muted/30">
                  <td colSpan={2} className="py-3 px-2">Totals</td>
                  <td className="py-3 px-2 text-right">Dr: {PKR(data.totalDebits)} / Cr: {PKR(data.totalCredits)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}

          {/* P&L */}
          {!loading&&data&&tab==='pnl'&&(
            <div>
              <h2 className="font-semibold mb-4">Profit & Loss Statement</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Income</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{PKR(data.totalIncome)}</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{PKR(data.totalExpenses)}</p>
                </div>
                <div className={`rounded-lg p-4 ${data.netProfit>=0?'bg-blue-50 dark:bg-blue-900/20':'bg-orange-50 dark:bg-orange-900/20'}`}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${data.netProfit>=0?'text-blue-700 dark:text-blue-400':'text-orange-600'}`}>{PKR(data.netProfit)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {!loading&&data&&tab==='balance-sheet'&&(
            <div>
              <h2 className="font-semibold mb-4">Balance Sheet</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-sm mb-3 text-emerald-700 dark:text-emerald-400">ASSETS</h3>
                  <div className="space-y-2 text-sm">
                    {[['Cash',data.assets?.cash],['Bank',data.assets?.bank],['Receivables',data.assets?.receivables]].map(([k,v])=>(
                      <div key={k as string} className="flex justify-between py-1 border-b border-border">
                        <span className="text-muted-foreground">{k as string}</span><span className="font-medium">{PKR(v as number)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t-2 border-primary/30">
                      <span>Total Assets</span><span className="text-primary">{PKR(data.assets?.total)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-3 text-red-600">LIABILITIES & EQUITY</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Payables</span><span className="font-medium">{PKR(data.liabilities?.payables)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Equity</span><span className="font-medium">{PKR(data.equity?.total)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold border-t-2 border-primary/30">
                      <span>Total L+E</span><span className="text-primary">{PKR((data.liabilities?.total||0)+(data.equity?.total||0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cash Book */}
          {!loading&&data&&tab==='cashbook'&&(
            <div>
              <h2 className="font-semibold mb-3">Cash Book</h2>
              {data.transactions?.length===0
                ?<p className="text-sm text-muted-foreground">No cash transactions recorded yet.</p>
                :(
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      {['Date','Description','Ref','Type','Amount'].map(h=><th key={h} className="py-2 px-3">{h}</th>)}
                    </tr></thead>
                    <tbody>{data.transactions?.map((t:any)=>(
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleDateString('en-PK')}</td>
                        <td className="py-2 px-3">{t.description||'—'}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{t.referenceType||'—'}</td>
                        <td className="py-2 px-3"><span className={t.type==='DEBIT'?'text-emerald-600 font-medium':'text-red-500 font-medium'}>{t.type}</span></td>
                        <td className="py-2 px-3 font-semibold">{PKR(Number(t.amount))}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )
              }
            </div>
          )}

          {/* Chart of Accounts */}
          {!loading&&tab==='accounts'&&(
            <div>
              <h2 className="font-semibold mb-3">Chart of Accounts</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  {['Account Name','Type','Branch','Balance'].map(h=><th key={h} className="py-2 px-3">{h}</th>)}
                </tr></thead>
                <tbody>{accounts.map((a:any)=>(
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{a.name}</td>
                    <td className="py-2 px-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.type}</span></td>
                    <td className="py-2 px-3">{a.branch?.name||'—'}</td>
                    <td className={`py-2 px-3 font-semibold ${Number(a.balance)<0?'text-red-500':'text-emerald-600'}`}>{PKR(Number(a.balance))}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
