'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';

export function Topbar() {
  const user = getCurrentUser();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // poll unread count every 30 s
    const fetch = () =>
      api.get<{ count: number }>('/notifications/unread-count')
        .then(r => setUnread(r.count))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div>
        {user?.branch && (
          <span className="text-sm text-muted-foreground">
            Branch: <span className="font-medium text-foreground">{user.branch.name}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/notifications')}
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        <ThemeToggle />

        {user && (
          <div
            className="flex cursor-pointer items-center gap-2 pl-2 text-sm"
            onClick={() => router.push('/dashboard/settings')}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="hidden sm:block">
              <p className="font-medium leading-tight">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground leading-tight">{user.role.name.replace(/_/g,' ')}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
