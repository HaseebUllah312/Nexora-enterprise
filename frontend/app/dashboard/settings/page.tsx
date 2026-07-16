'use client';
import { useState, useEffect } from 'react';
import { User, Lock, Globe, Bell, CheckCircle, Eye, EyeOff, Database, RefreshCw, Save, Trash2, AlertTriangle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { api } from '@/lib/api';
import { Field, Input } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import Cookies from 'js-cookie';

export default function SettingsPage() {
  const user = getCurrentUser();
  const [tab, setTab] = useState('profile');

  const TABS = [
    { key:'profile',       label:'My Profile',      icon:User  },
    { key:'security',      label:'Change Password',  icon:Lock  },
    { key:'appearance',    label:'Appearance',       icon:Globe },
    { key:'notifications', label:'Notifications',    icon:Bell  },
  ];

  TABS.push({ key:'backup', label:'Backup & Restore', icon:Database });
  TABS.push({ key:'data-management', label:'Data Management', icon:Trash2 });

  // Show Cloud Sync tab only if running inside desktop app or localhost
  const isDesktop = typeof window !== 'undefined' && ((window as any).electronAPI || window.location.hostname === 'localhost');
  if (isDesktop) {
    TABS.push({ key:'sync', label:'Cloud Sync Settings', icon:RefreshCw });
  }

  return (
    <div className="flex gap-6 max-w-4xl">
      <aside className="w-52 shrink-0">
        <nav className="flex flex-col gap-0.5">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-left transition-colors ${tab===t.key?'bg-primary/10 text-primary font-medium':'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <t.icon size={15} className="shrink-0"/>{t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-6">
        {tab==='profile' && user && <ProfileTab user={user}/>}
        {tab==='security' && user && <SecurityTab user={user}/>}
        {tab==='appearance'    && <AppearanceTab/>}
        {tab==='notifications' && <NotificationsTab/>}
        {tab==='backup'        && <BackupTab/>}
        {tab==='data-management' && <DataManagementTab/>}
        {tab==='sync'          && <SyncTab/>}
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-5">My Profile</h2>
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div>
          <p className="font-bold text-xl">{user.firstName} {user.lastName}</p>
          <p className="text-sm text-muted-foreground">{user.role.name.replace(/_/g,' ')}</p>
          {user.branch && <p className="text-sm text-muted-foreground">{user.branch.name}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          ['First Name', user.firstName],
          ['Last Name',  user.lastName],
          ['Email',      user.email],
          ['Role',       user.role.name.replace(/_/g,' ')],
          ['Branch',     user.branch?.name ?? 'All Branches'],
        ].map(([label,value])=>(
          <div key={label}>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
            <p className="mt-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityTab({ user }: { user: any }) {
  const [form, setForm]         = useState({ current:'', next:'', confirm:'' });
  const [errors, setErrors]     = useState<Record<string,string>>({});
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [showCurr, setShowCurr] = useState(false);
  const [showNext, setShowNext] = useState(false);

  function set(f:string, v:string){ setForm(p=>({...p,[f]:v})); setErrors(p=>({...p,[f]:''})); }

  async function submit(){
    const e:Record<string,string>={};
    if(!form.current)          e.current='Enter your current password';
    if(form.next.length<8)     e.next='Minimum 8 characters';
    if(form.next!==form.confirm) e.confirm='Passwords do not match';
    setErrors(e);
    if(Object.keys(e).length) return;
    setLoading(true);
    try{
      await api.patch('/users/me/change-password',{
        currentPassword: form.current,
        newPassword:     form.next,
      });
      setSuccess(true);
      setForm({current:'',next:'',confirm:''});
    }catch(err:any){ setErrors({submit:err.message}); }
    finally{ setLoading(false); }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-5">Change Password</h2>
      <div className="flex flex-col gap-4 max-w-sm">
        {success&&(
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle size={16}/> Password changed successfully.
          </div>
        )}
        <Field label="Current Password" required error={errors.current}>
          <div className="relative">
            <Input type={showCurr?'text':'password'} value={form.current}
              onChange={e=>set('current',e.target.value)} placeholder="••••••••" error={!!errors.current}/>
            <button type="button" onClick={()=>setShowCurr(v=>!v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurr?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
        </Field>
        <Field label="New Password" required error={errors.next} hint="Minimum 8 characters">
          <div className="relative">
            <Input type={showNext?'text':'password'} value={form.next}
              onChange={e=>set('next',e.target.value)} placeholder="••••••••" error={!!errors.next}/>
            <button type="button" onClick={()=>setShowNext(v=>!v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNext?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
        </Field>
        <Field label="Confirm New Password" required error={errors.confirm}>
          <Input type="password" value={form.confirm}
            onChange={e=>set('confirm',e.target.value)} placeholder="••••••••" error={!!errors.confirm}/>
        </Field>
        {errors.submit&&<p className="text-sm text-red-500">{errors.submit}</p>}
        <SubmitButton loading={loading} label="Update Password" onClick={submit} type="button"/>
      </div>
    </div>
  );
}

function AppearanceTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-5">Appearance</h2>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">Dark Mode</p>
          <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
        </div>
        <ThemeToggle/>
      </div>
    </div>
  );
}

function NotifToggle({ defaultOn }:{ defaultOn:boolean }) {
  const [on,setOn]=useState(defaultOn);
  return (
    <button onClick={()=>setOn(v=>!v)}
      className={`relative h-6 w-11 rounded-full transition-colors ${on?'bg-primary':'bg-muted-foreground/30'}`}
      role="switch" aria-checked={on}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${on?'translate-x-6':'translate-x-1'}`}/>
    </button>
  );
}

function NotificationsTab() {
  const items = [
    { label:'Low Stock Alerts',       desc:'When stock drops below minimum level',        on:true  },
    { label:'New Order Alerts',        desc:'When a new sales order is created',           on:true  },
    { label:'Payment Received',        desc:'When a customer payment is recorded',         on:true  },
    { label:'Production Completed',    desc:'When a production order finishes',            on:false },
    { label:'Stock Transfer Updates',  desc:'When a transfer changes status',              on:false },
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold mb-5">Notifications</h2>
      <div className="flex flex-col gap-3">
        {items.map(item=>(
          <div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <NotifToggle defaultOn={item.on}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleBackup() {
    setLoading(true); setSuccess(''); setError('');
    try {
      const apiObj = (window as any).electronAPI;
      if (apiObj?.backupDatabase) {
        const res = await apiObj.backupDatabase();
        if (res.success) {
          setSuccess(`Backup exported successfully to: ${res.filePath}`);
        } else if (res.error) {
          setError(res.error);
        }
      } else {
        const apiBase = typeof window !== 'undefined'
          ? ((window as any).electronAPI?.isDesktop 
              ? 'http://localhost:4000/api/v1' 
              : (process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api/v1`))
          : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');
        const response = await fetch(`${apiBase}/company-settings/backup`, {
          headers: {
            'Authorization': `Bearer ${Cookies.get('accessToken')}`
          }
        });
        if (!response.ok) throw new Error('Backup download failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nexora-Backup-${new Date().toISOString().split('T')[0]}.db`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess('Backup downloaded successfully via browser.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export backup');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true); setSuccess(''); setError('');
    try {
      const apiObj = (window as any).electronAPI;
      if (apiObj?.restoreDatabase) {
        const res = await apiObj.restoreDatabase();
        if (res && res.error) {
          setError(res.error);
        }
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) {
            setLoading(false);
            return;
          }
          
          if (!confirm('Are you sure you want to restore this backup? This will overwrite all current local data.')) {
            setLoading(false);
            return;
          }

          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              await api.post('/company-settings/restore', { fileData: base64 });
              setSuccess('Database restored successfully! Please refresh or restart the app.');
            } catch (err: any) {
              setError(err.message || 'Failed to restore database');
            } finally {
              setLoading(false);
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import backup');
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Backup &amp; Restore Database</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Save all your products, customers, transactions, settings, and stock data to a backup file, or restore a backup file to this PC.
      </p>

      <div className="flex flex-col gap-4 max-w-xl">
        {success && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle size={16} className="shrink-0"/> <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="rounded-lg border border-border p-5 flex flex-col justify-between bg-card">
            <div>
              <h3 className="font-semibold text-base mb-1 text-foreground">Export Backup</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Saves a copy of your current local database (`factory_erp.db`) to your documents or selected folder.
              </p>
            </div>
            <button
              onClick={handleBackup}
              disabled={loading}
              className="mt-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : 'Create Backup'}
            </button>
          </div>

          <div className="rounded-lg border border-border p-5 flex flex-col justify-between bg-card">
            <div>
              <h3 className="font-semibold text-base mb-1 text-foreground">Import Backup</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Selects a previously saved `.db` backup file and restores it. Warning: This will overwrite all current local data.
              </p>
            </div>
            <button
              onClick={handleRestore}
              disabled={loading}
              className="mt-2 w-full rounded-md border border-red-500 text-red-500 px-4 py-2.5 text-sm font-semibold hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : 'Restore Backup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncTab() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [status, setStatus] = useState({
    enabled: false,
    unsyncedCount: 0,
    syncedCount: 0,
    syncTargetUrl: '',
    supabaseDbUrl: '',
    lastError: null as string | null,
  });

  const [form, setForm] = useState({
    syncTargetUrl: '',
    syncSecret: '',
    supabaseDbUrl: '',
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await api.get<any>('/sync/status');
      setStatus(res);
      setForm({
        syncTargetUrl: res.syncTargetUrl,
        syncSecret: '',
        supabaseDbUrl: res.supabaseDbUrl,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cloud sync status.');
    }
  }

  async function handleSaveConfig() {
    setLoading(true); setSuccess(''); setError('');
    try {
      if (!form.syncTargetUrl) throw new Error('Sync Target URL is required.');
      if (!form.supabaseDbUrl) throw new Error('Supabase Cloud Database URL is required.');

      const res = await api.post<any>('/sync/config', form);
      setSuccess(res.message || 'Sync settings saved successfully! Please restart the desktop app.');
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerSync() {
    setSyncing(true); setSuccess(''); setError('');
    try {
      const res = await api.post<any>('/sync/trigger');
      if (res.success) {
        setSuccess(`Manual synchronization complete! Pushed changes to the cloud.`);
        setStatus(prev => ({
          ...prev,
          unsyncedCount: res.unsyncedCount,
          syncedCount: prev.syncedCount + (prev.unsyncedCount - res.unsyncedCount)
        }));
      } else {
        setError(res.message || 'Sync was not triggered. Check configuration.');
      }
    } catch (err: any) {
      setError(err.message || 'Sync failed. Ensure branch is online and credentials are correct.');
    } finally {
      setSyncing(false);
      fetchStatus();
    }
  }

  async function handleClearQueue() {
    if (!confirm('This will mark all pending sync entries as done without pushing them to cloud. Use this to clear stuck seed data. Continue?')) return;
    setSyncing(true); setSuccess(''); setError('');
    try {
      const res = await api.post<any>('/sync/clear-queue', {});
      if (res.success) {
        setSuccess(`Cleared ${res.cleared} stuck pending sync entries. Your local data is safe — entries were only from initialization.`);
        fetchStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear sync queue.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleResetPointer() {
    if (!confirm('This will reset your sync history pointer. The app will immediately pull all categories, products, stock levels, and settings from the cloud database to this laptop. Offline changes not yet synced might be overwritten. Continue?')) return;
    setSyncing(true); setSuccess(''); setError('');
    try {
      const res = await api.post<any>('/sync/reset-pointer', {});
      if (res.success) {
        setSuccess('Sync pointer reset! Pulling all cloud data...');
        const syncRes = await api.post<any>('/sync/trigger');
        if (syncRes.success) {
          setSuccess('Successfully pulled all cloud products and data to this laptop!');
        } else {
          setError(syncRes.message || 'Sync reset succeeded, but initial pull failed.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to force pull data.');
    } finally {
      setSyncing(false);
      fetchStatus();
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Cloud Database Synchronization</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Configure your local branch desktop application to push transactions, customers, and inventory data automatically to the central Supabase cloud database.
      </p>

      <div className="flex flex-col gap-5 max-w-xl">
        {success && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle size={16} className="shrink-0"/> <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            <span>{error}</span>
          </div>
        )}

        {/* Sync Status Info */}
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Sync Status</span>
            <p className={`text-sm font-bold mt-1 ${status.enabled ? 'text-emerald-600' : 'text-amber-500'}`}>
              {status.enabled ? '✓ Connected' : '✗ Config Required'}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Unsynced Changes</span>
            <p className="text-sm font-bold mt-1 text-foreground">
              {status.unsyncedCount} pending
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Synced Logs</span>
            <p className="text-sm font-bold mt-1 text-foreground">
              {status.syncedCount} entries
            </p>
          </div>
        </div>

        {/* Manual Sync Trigger */}
        <div className="border border-border rounded-lg p-5 bg-card">
          <h3 className="font-semibold text-base mb-1 text-foreground">Push Local Changes to Cloud</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Manually trigger the sync service to upload any offline modifications (sales, purchases, stocks) to your central Supabase database.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleTriggerSync}
              disabled={syncing || !status.enabled}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''}/>
              {syncing ? 'Synchronizing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleResetPointer}
              disabled={syncing || !status.enabled}
              className="flex items-center justify-center gap-2 rounded-md border border-primary text-primary bg-background px-4 py-2.5 text-sm font-semibold shadow hover:bg-muted disabled:opacity-50 transition-colors"
            >
              🔄 Force Pull All Cloud Data
            </button>
          </div>
          {status.unsyncedCount > 0 && (
            <button
              onClick={handleClearQueue}
              disabled={syncing}
              className="mt-3 flex items-center justify-center gap-2 rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 transition-colors"
            >
              🗑️ Clear Stuck Queue ({status.unsyncedCount} pending)
            </button>
          )}
          {status.lastError && (
            <div className="mt-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">⚠ Last Sync Error:</p>
              <p className="text-xs text-red-600 dark:text-red-400 break-all font-mono">{status.lastError}</p>
            </div>
          )}
        </div>

        {/* Settings Form */}
        <div className="border border-border rounded-lg p-5 bg-card">
          <h3 className="font-semibold text-base mb-4 text-foreground">Sync Credentials</h3>
          
          <div className="flex flex-col gap-4">
            <Field label="Cloud Sync URL (Vercel Endpoint)" required>
              <Input
                value={form.syncTargetUrl}
                onChange={e => setForm(prev => ({ ...prev, syncTargetUrl: e.target.value }))}
                placeholder="https://nexoraenterprise.vercel.app/api/v1/sync"
              />
            </Field>

            <Field label="Sync Secret Key (SYNC_SECRET)" required>
              <Input
                type="password"
                value={form.syncSecret}
                onChange={e => setForm(prev => ({ ...prev, syncSecret: e.target.value }))}
                placeholder="Enter SYNC_SECRET key"
              />
            </Field>

            <Field label="Supabase Database URL (Transaction Mode Pooler)" required hint="Used by local client to track changes">
              <Input
                type="password"
                value={form.supabaseDbUrl}
                onChange={e => setForm(prev => ({ ...prev, supabaseDbUrl: e.target.value }))}
                placeholder="postgresql://postgres.xxx:pass@aws-0.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
              />
            </Field>

            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-md bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors mt-2"
            >
              <Save size={15}/>
              Save Sync Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataManagementTab() {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ scope: string; label: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const ACTIONS = [
    {
      scope: 'sales',
      label: 'Delete All Sale History',
      description: 'Permanently deletes all sales orders, sales invoices, and sale returns.',
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
      btn: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      scope: 'purchases',
      label: 'Delete All Purchase History',
      description: 'Permanently deletes all purchase orders, purchase invoices, and purchase returns.',
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
      btn: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
      scope: 'inventory',
      label: 'Clear Inventory & Stock',
      description: 'Removes all stock entries and stock movement logs from all warehouses.',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
      btn: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      scope: 'products',
      label: 'Delete All Products & Categories',
      description: 'Permanently deletes all products, categories, and BOMs.',
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
      btn: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      scope: 'customers',
      label: 'Delete All Customers',
      description: 'Permanently deletes all customer records and their ledger accounts.',
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800',
      btn: 'bg-pink-600 hover:bg-pink-700',
    },
    {
      scope: 'accounting',
      label: 'Clear Accounting & Expenses',
      description: 'Deletes all accounting transactions and expense records.',
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800',
      btn: 'bg-teal-600 hover:bg-teal-700',
    },
    {
      scope: 'all',
      label: '⚠ Full Database Reset',
      description: 'DANGER: Deletes ALL operational records — sales, purchases, inventory, products, customers, suppliers, accounting, and sync logs. Roles, branches, and user accounts are kept intact.',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
      btn: 'bg-red-600 hover:bg-red-700',
    },
  ];

  async function handleClear(scope: string) {
    setLoading(scope); setSuccess(''); setError('');
    try {
      const res = await api.post<any>('/sync/clear-data', { scope });
      if (res.success) {
        const total = Object.values(res.deleted as Record<string, number>).reduce((a, b) => a + b, 0);
        setSuccess(`Done! Deleted ${total} records for: ${scope}.`);
      } else {
        setError('Operation failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear data.');
    } finally {
      setLoading(null);
      setConfirm(null);
      setConfirmText('');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Data Management</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Permanently delete specific categories of data from this branch's local database. These actions cannot be undone.
      </p>

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-4">
          <CheckCircle size={16} className="shrink-0"/><span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 mb-4">
          <AlertTriangle size={16} className="shrink-0"/><span>{error}</span>
        </div>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600"/>
              </div>
              <div>
                <h3 className="font-semibold text-base">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground">This action is permanent and cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-4">
              You are about to permanently delete: <strong>{confirm.label}</strong>.
              Type <code className="bg-muted px-1 rounded text-xs font-mono">DELETE</code> below to confirm.
            </p>
            <input
              type="text"
              placeholder="Type DELETE to confirm"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirm(null); setConfirmText(''); }}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={confirmText !== 'DELETE' || !!loading}
                onClick={() => handleClear(confirm.scope)}
                className="flex-1 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                {loading === confirm.scope ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {ACTIONS.map(action => (
          <div key={action.scope} className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${action.bg}`}>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${action.color}`}>{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
            <button
              onClick={() => { setSuccess(''); setError(''); setConfirm({ scope: action.scope, label: action.label }); }}
              disabled={!!loading}
              className={`shrink-0 flex items-center gap-2 rounded-md ${action.btn} text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Trash2 size={13}/>
              {loading === action.scope ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
