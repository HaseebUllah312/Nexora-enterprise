'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, ReceiptText,
  Factory, BookOpen, Users, Truck, Bell, Settings, Building2,
  LogOut, UserCircle, BarChart2, Sparkles, Tag, ShieldCheck,
  FolderOpen, TrendingDown, RotateCcw, FileText, ClipboardList,
  Layers, ChevronDown, ChevronRight, Wallet,
} from 'lucide-react';
import { logout, getCurrentUser } from '@/lib/auth';
import { useState } from 'react';

interface NavItem { href: string; label: string; icon: any; }
interface NavSection { label: string; items: NavItem[]; sub?: { label:string; href:string; icon:any }[]; }

const NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href:'/dashboard', label:'Dashboard', icon:LayoutDashboard }],
  },
  {
    label: 'Sales',
    items: [
      { href:'/dashboard/sales',            label:'Invoices & Orders', icon:ShoppingCart },
      { href:'/dashboard/sales/aging',      label:'Aging Report',      icon:ClipboardList },
      { href:'/dashboard/customers',        label:'Customers',         icon:UserCircle },
      { href:'/dashboard/customers/statement', label:'Customer Statement', icon:FileText },
      { href:'/dashboard/challans',         label:'Delivery Challans', icon:Truck },
    ],
  },
  {
    label: 'Purchases',
    items: [
      { href:'/dashboard/purchases',        label:'Purchase Orders',   icon:ReceiptText },
      { href:'/dashboard/suppliers',        label:'Suppliers',         icon:FolderOpen },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href:'/dashboard/inventory',        label:'Stock Levels',      icon:Warehouse },
      { href:'/dashboard/products',         label:'Products',          icon:Package },
      { href:'/dashboard/categories',       label:'Categories',        icon:Tag },
    ],
  },
  {
    label: 'Manufacturing',
    items: [
      { href:'/dashboard/production',       label:'Production Orders', icon:Factory },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href:'/dashboard/accounting',       label:'Accounting',        icon:BookOpen },
      { href:'/dashboard/expenses',         label:'Expenses',          icon:TrendingDown },
      { href:'/dashboard/returns',          label:'Returns',           icon:RotateCcw },
      { href:'/dashboard/reports',          label:'Reports',           icon:BarChart2 },
    ],
  },
  {
    label: 'HR',
    items: [
      { href:'/dashboard/employees',        label:'Employees',         icon:Users },
      { href:'/dashboard/payroll',          label:'Payroll',           icon:Wallet },
      { href:'/dashboard/vehicles',         label:'Vehicles',          icon:Truck },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href:'/dashboard/branches',         label:'Branches',          icon:Building2 },
      { href:'/dashboard/warehouses',       label:'Warehouses',        icon:Warehouse },
      { href:'/dashboard/users',            label:'Users & Access',    icon:ShieldCheck },
      { href:'/dashboard/company-settings', label:'Company Settings',  icon:Settings },
      { href:'/dashboard/ai-analytics',     label:'AI Analytics',      icon:Sparkles },
      { href:'/dashboard/notifications',    label:'Notifications',     icon:Bell },
      { href:'/dashboard/settings',         label:'My Settings',       icon:Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = getCurrentUser();
  const isSuperAdminOrOwner = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'OWNER';

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-white overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4 shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Factory size={17}/>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">Nexora Enterprise</p>
          <p className="truncate text-[10px] text-white/40 leading-tight">HM Nexora ERP</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {NAV.map(section => {
          // Hide Admin section for non-admin roles except settings/notifications
          const filteredItems = section.label === 'Admin' && !isSuperAdminOrOwner
            ? section.items.filter(i => ['/dashboard/settings','/dashboard/notifications'].includes(i.href))
            : section.items;

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-4">
              <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {filteredItems.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors leading-tight ${
                        active
                          ? 'bg-white/15 text-white font-semibold'
                          : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                      }`}>
                      <Icon size={14} className="shrink-0"/>
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3 shrink-0">
        {user && (
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer" onClick={()=>window.location.href='/dashboard/settings'}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight">{user.firstName} {user.lastName}</p>
              <p className="truncate text-[10px] text-white/40 leading-tight">
                {user.role.name.replace(/_/g,' ')}
                {user.branch ? ` · ${user.branch.name}` : ' · All Branches'}
              </p>
            </div>
          </div>
        )}
        <button onClick={()=>logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 hover:bg-white/8 hover:text-white/80 transition-colors">
          <LogOut size={14}/>Sign out
        </button>
      </div>
    </aside>
  );
}
