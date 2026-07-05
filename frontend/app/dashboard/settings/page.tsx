'use client';
import { useState } from 'react';
import { User, Lock, Globe, Bell, CheckCircle, Eye, EyeOff, Database } from 'lucide-react';
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/company-settings/backup`, {
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
