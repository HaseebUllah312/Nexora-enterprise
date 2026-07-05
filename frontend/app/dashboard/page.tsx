'use client';
import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, Factory, TrendingUp, AlertTriangle, Wallet, Landmark, ArrowDownToLine, Loader2, Building2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { KpiCard } from '@/components/layout/kpi-card';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Summary {
  todaySales:number; monthlySales:number; totalPurchases:number; totalProduction:number;
  totalReceivables:number; totalPayables:number; cashBalance:number; bankBalance:number;
  branchSales:{branch:string;monthlySales:number}[];
  lowStockCount:number; pendingTransfers:number;
  lowStockItems:{id:string;name:string;sku:string;totalStock:number;minimumStock:number}[];
}

const PKR = (v:number) => 'PKR ' + v.toLocaleString('en-PK',{maximumFractionDigits:0});

export default function DashboardPage() {
  const user = getCurrentUser();
  const [summary,setSummary] = useState<Summary|null>(null);
  const [trend,setTrend]     = useState<{month:string;sales:number}[]>([]);
  const [loading,setLoading] = useState(true);

  const isOwnerOrAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'OWNER';
  const branchName = user?.branch?.name ?? 'All Branches';

  useEffect(()=>{
    const branchParam = user?.branch?.id ? `?branchId=${user.branch.id}` : '';
    Promise.all([
      api.get<Summary>(`/dashboard/summary`),
      api.get<{month:string;sales:number}[]>(`/dashboard/sales-trend${branchParam}`),
    ])
    .then(([s,t])=>{ setSummary(s); setTrend(t); })
    .finally(()=>setLoading(false));
  },[]);

  if(loading) return(
    <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
      <Loader2 size={20} className="animate-spin"/>Loading dashboard...
    </div>
  );
  if(!summary) return <div className="text-red-500">Failed to load dashboard.</div>;

  return(
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isOwnerOrAdmin ? 'Owner Dashboard' : `${branchName} Dashboard`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isOwnerOrAdmin
              ? 'Consolidated real-time view across all branches'
              : `Live data for ${branchName} — your branch only`}
          </p>
        </div>
        {!isOwnerOrAdmin && (
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Building2 size={12}/>{branchName}
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Today's Sales"    value={PKR(summary.todaySales)}         icon={DollarSign}      trend={{value:'vs yesterday',positive:true}}/>
        <KpiCard label="Monthly Sales"    value={PKR(summary.monthlySales)}        icon={TrendingUp}/>
        <KpiCard label="Total Purchases"  value={PKR(summary.totalPurchases)}      icon={ShoppingCart}/>
        <KpiCard label="Units Produced"   value={summary.totalProduction.toLocaleString()} icon={Factory}/>
        <KpiCard label="Receivables"      value={PKR(summary.totalReceivables)}    icon={ArrowDownToLine}/>
        <KpiCard label="Payables"         value={PKR(summary.totalPayables)}       icon={AlertTriangle}/>
        <KpiCard label="Cash Balance"     value={PKR(summary.cashBalance)}         icon={Wallet}/>
        <KpiCard label="Bank Balance"     value={PKR(summary.bankBalance)}         icon={Landmark}/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Sales Trend — 6 months</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12}/>
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}/>
              <Tooltip formatter={(v:number)=>PKR(v)}/>
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {isOwnerOrAdmin && summary.branchSales.length > 0 ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Branch Performance (this month)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={summary.branchSales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="branch" stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                <Tooltip formatter={(v:number)=>PKR(v)}/>
                <Bar dataKey="monthlySales" name="Sales" fill="hsl(var(--primary))" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Quick Stats</h2>
            <div className="flex flex-col gap-2 text-sm">
              {[
                ['Pending Transfers', summary.pendingTransfers.toString()],
                ['Low Stock Items',   summary.lowStockCount.toString()],
                ['Net Receivables',   PKR(summary.totalReceivables - summary.totalPayables)],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between rounded-lg bg-muted/40 px-4 py-2.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Low stock alerts */}
      {summary.lowStockItems.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16}/> Low Stock Alerts — {summary.lowStockCount} product{summary.lowStockCount!==1?'s':''} need restocking
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {summary.lowStockItems.map(item=>(
              <div key={item.id} className="rounded-md border border-amber-200 bg-white dark:border-amber-800 dark:bg-card p-3">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku}</p>
                <div className="mt-1.5 flex items-center gap-1 text-xs">
                  <span className="text-red-500 font-semibold">{item.totalStock} left</span>
                  <span className="text-muted-foreground">· min {item.minimumStock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending transfers info */}
      {summary.pendingTransfers > 0 && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 px-5 py-3 text-sm text-blue-700 dark:text-blue-400">
          <span className="font-semibold">{summary.pendingTransfers}</span> stock transfer{summary.pendingTransfers!==1?'s':''} pending action — <a href="/dashboard/inventory" className="underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200">view in Inventory</a>
        </div>
      )}
    </div>
  );
}
