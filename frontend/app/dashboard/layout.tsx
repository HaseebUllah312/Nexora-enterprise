'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
