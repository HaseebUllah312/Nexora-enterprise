'use client';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Package, ShoppingCart, DollarSign, Factory, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface Notification { id:string; type:string; title:string; message:string; isRead:boolean; createdAt:string; }

const TYPE_ICON: Record<string, any> = {
  LOW_STOCK: Package, NEW_ORDER: ShoppingCart, PAYMENT_RECEIVED: DollarSign,
  PRODUCTION_COMPLETED: Factory, SYSTEM: Info,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ load(); },[]);

  async function load() {
    setLoading(true);
    const data = await api.get<Notification[]>('/notifications').catch(()=>[]);
    setNotifications(data as Notification[]);
    setLoading(false);
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    load();
  }

  async function markRead(id:string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(n=>n.map(x=>x.id===id?{...x,isRead:true}:x));
  }

  const unread = notifications.filter(n=>!n.isRead).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          {unread>0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{unread} new</span>}
        </div>
        {unread>0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <CheckCheck size={15}/> Mark all read
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {loading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</p>}
        {!loading && notifications.length===0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bell size={32} className="opacity-30"/>
            <p className="text-sm">You're all caught up!</p>
          </div>
        )}
        {notifications.map(n=>{
          const Icon = TYPE_ICON[n.type] || Info;
          return (
            <div key={n.id} onClick={()=>!n.isRead&&markRead(n.id)}
              className={`flex gap-4 px-5 py-4 cursor-pointer transition-colors ${n.isRead?'':'bg-primary/5 hover:bg-primary/10'} hover:bg-muted/60`}>
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.isRead?'bg-muted text-muted-foreground':'bg-primary/10 text-primary'}`}>
                <Icon size={16}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.isRead?'':'font-semibold'}`}>{n.title}</p>
                  {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"/>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
