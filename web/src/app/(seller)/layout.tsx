'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { 
  LayoutDashboard, 
  Package, 
  FileCheck, 
  CreditCard, 
  Wallet, 
  Settings, 
  Bell, 
  Menu, 
  X, 
  LogOut, 
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

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sidebarItems: SidebarItem[] = [
    { name: 'Панель', href: '/seller', icon: LayoutDashboard },
    { name: 'Товары', href: '/seller/products', icon: Package },
    { name: 'Сертификаты', href: '/seller/certifications', icon: FileCheck },
    { name: 'Заказы', href: '/seller/orders', icon: CreditCard },
    { name: 'Финансы', href: '/seller/finances', icon: Wallet },
    { name: 'Настройки', href: '/seller/settings', icon: Settings },
  ];

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-secondary))] text-[hsl(var(--text-primary))] flex">
      
      {/* ── LEFT SIDEBAR ── */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-[hsl(var(--border-default))] bg-[hsl(var(--bg-primary))] flex flex-col justify-between transition-transform duration-300 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col flex-1">
          {/* Logo & Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-[hsl(var(--border-default))]">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white shadow">
                <Stethoscope className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-[hsl(var(--text-primary))]">
                DentalMarket
              </span>
            </Link>
            <button 
              className="md:hidden p-1.5 rounded-lg hover:bg-[hsl(var(--bg-secondary))]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 outline-none",
                    isActive 
                      ? "bg-[hsl(var(--color-secondary-light))] text-[hsl(var(--color-secondary))] border-l-4 border-[hsl(var(--color-secondary))]" 
                      : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-secondary))]"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[hsl(var(--border-default))] space-y-2">
          <Link href="/" className="flex w-full">
            <Button variant="outline" size="sm" className="w-full flex items-center gap-2 justify-center text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Вернуться в магазин
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center text-xs text-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error-light))] border-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти из кабинета
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
            <h2 className="font-bold text-base md:text-lg text-[hsl(var(--text-primary))]">Кабинет партнера</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button className="relative p-2 rounded-full hover:bg-[hsl(var(--bg-secondary))] transition-colors">
              <Bell className="h-5 w-5 text-[hsl(var(--text-secondary))]" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[hsl(var(--color-primary))] animate-pulse"></span>
            </button>
            
            {/* User Meta */}
            <div className="flex items-center gap-2">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-[hsl(var(--text-primary))]">{user?.email || 'Продавец'}</p>
                <p className="text-[10px] text-[hsl(var(--color-secondary))] font-bold uppercase tracking-wider">Дилер</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-[hsl(var(--bg-secondary))] border border-[hsl(var(--border-default))] flex items-center justify-center font-bold text-sm text-[hsl(var(--color-secondary))]">
                {user?.email?.substring(0, 2).toUpperCase() || 'SL'}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Area */}
        <main className="flex-grow p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
