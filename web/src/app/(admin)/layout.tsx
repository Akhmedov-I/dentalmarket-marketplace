'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { 
  ShieldAlert, 
  Users, 
  Store, 
  FileCheck, 
  Gavel, 
  Wallet2, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  ArrowLeft,
  Stethoscope 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sidebarItems: SidebarItem[] = [
    { name: 'Панель', href: '/admin', icon: ShieldAlert },
    { name: 'Пользователи', href: '/admin/users', icon: Users },
    { name: 'Продавцы (KYC)', href: '/admin/sellers', icon: Store },
    { name: 'Сертификаты', href: '/admin/certifications', icon: FileCheck },
    { name: 'Споры', href: '/admin/disputes', icon: Gavel },
    { name: 'Финансы', href: '/admin/finances', icon: Wallet2 },
    { name: 'Аудит системы', href: '/admin/audit', icon: FileText },
  ];

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-secondary))] text-[hsl(var(--text-primary))] flex">
      
      {/* ── LEFT SIDEBAR (Dark Theme Variant) ── */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[hsl(222_47%_11%)] text-[hsl(220_13%_91%)] flex flex-col justify-between transition-transform duration-300 md:relative md:translate-x-0 border-r border-[hsl(222_47%_18%)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col flex-1">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-[hsl(222_47%_18%)]">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white shadow">
                <Stethoscope className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white">
                DentalAdmin
              </span>
            </Link>
            <button 
              className="md:hidden p-1.5 rounded-lg hover:bg-[hsl(222_47%_18%)] text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 outline-none",
                    isActive 
                      ? "bg-[hsl(var(--color-primary))] text-white shadow-md border-l-4 border-white" 
                      : "text-[hsl(220_14%_70%)] hover:text-white hover:bg-[hsl(222_47%_18%)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[hsl(222_47%_18%)] space-y-2">
          <Link href="/" className="flex w-full">
            <Button variant="outline" size="sm" className="w-full flex items-center gap-2 justify-center text-xs text-white border-white/20 hover:bg-white/5 bg-transparent">
              <ArrowLeft className="h-3.5 w-3.5" />
              В магазин
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center text-xs text-rose-400 hover:bg-rose-500/10 border-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти из панели
          </Button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="flex-grow flex flex-col min-h-screen">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-primary))] flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[hsl(var(--bg-secondary))] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 tracking-wider uppercase">
              Super Admin Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* User details */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-bold text-[hsl(var(--text-primary))]">{user?.email || 'Administrator'}</p>
                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Администратор</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-[hsl(222_47%_11%)] text-white flex items-center justify-center font-bold text-sm">
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic content rendering */}
        <main className="flex-grow p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
