'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, Loader2, Eye, EyeOff } from 'lucide-react';
import { login } from '@/lib/auth';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar text-white p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Factory size={22}/>
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Nexora Enterprise</p>
            <p className="text-xs text-white/50 leading-tight">Developed by HM Nexora</p>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Complete ERP for<br/>PVC · PPRC · Sanitary<br/>Manufacturing
          </h1>
          <p className="text-white/60 text-lg">Multi-branch · AI-powered · Real-time</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Features</p>
          {['Sales & Purchase Management','Multi-branch Stock Control','Manufacturing & BOM','Accounting & Reports','AI Analytics Assistant'].map(f=>(
            <div key={f} className="flex items-center gap-2 text-sm text-white/70">
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"/>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4"><ThemeToggle/></div>

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Factory size={18}/>
            </div>
            <span className="font-bold text-lg">Nexora Enterprise</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">Enter your credentials to access the system</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@company.com"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <input type={showPw?'text':'password'} required value={password} onChange={e=>setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"/>
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>
            {error && <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
              {loading&&<Loader2 size={16} className="animate-spin"/>}
              Sign in to Nexure Enterprise
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
