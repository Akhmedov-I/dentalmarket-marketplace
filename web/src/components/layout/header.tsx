'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  Stethoscope, 
  Search, 
  ShoppingCart, 
  User as UserIcon, 
  Menu, 
  X, 
  LogOut, 
  Settings, 
  ShoppingBag, 
  Shield 
} from 'lucide-react';
import { useAuthStore, useCartStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const { itemCount } = useCartStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  const isSeller = user?.roles?.includes('seller');
  const isAdmin = user?.roles?.includes('admin');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-primary)/0.8)] backdrop-blur-md transition-all duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-[1.02]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white shadow-md">
            <Stethoscope className="h-5 w-5 animate-pulse-glow" />
          </div>
          <span className="gradient-text text-xl font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))]">
            DentalMarket
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link 
            href="/search" 
            className={cn(
              "transition-colors hover:text-[hsl(var(--color-primary))]",
              pathname === '/search' ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--text-secondary))]"
            )}
          >
            Каталог
          </Link>
          <Link 
            href="/about" 
            className={cn(
              "transition-colors hover:text-[hsl(var(--color-primary))]",
              pathname === '/about' ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--text-secondary))]"
            )}
          >
            О нас
          </Link>
        </nav>

        {/* Search Bar - Desktop */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex relative w-full max-w-sm items-center gap-2 ml-4">
          <input
            type="search"
            placeholder="Поиск инструментов, оборудования..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pr-10 w-full"
          />
          <button type="submit" className="absolute right-3 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--color-primary))] transition-colors">
            <Search className="h-4 w-4" />
          </button>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Cart Icon */}
          <Link href="/cart" className="relative p-2.5 rounded-full hover:bg-[hsl(var(--bg-secondary))] transition-colors group">
            <ShoppingCart className="h-5 w-5 text-[hsl(var(--text-secondary))] group-hover:text-[hsl(var(--color-primary))] transition-colors" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--color-error))] text-[10px] font-bold text-white shadow-sm animate-scale-in">
                {itemCount}
              </span>
            )}
          </Link>

          {/* User Menu / Auth Buttons */}
          {isAuthenticated && user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center justify-center h-10 w-10 rounded-full border-2 border-[hsl(var(--color-primary))] bg-[hsl(var(--bg-secondary))] text-[hsl(var(--text-primary))] hover:ring-2 hover:ring-[hsl(var(--color-primary)/0.2)] transition-all">
                  {user.email.substring(0, 2).toUpperCase()}
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="z-50 min-w-[220px] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] p-1.5 shadow-xl animate-scale-in"
                  align="end"
                  sideOffset={8}
                >
                  <div className="px-2.5 py-2 border-b border-[hsl(var(--border-default))]">
                    <p className="text-xs text-[hsl(var(--text-tertiary))]">Вы вошли как</p>
                    <p className="text-sm font-semibold truncate text-[hsl(var(--text-primary))]">{user.email}</p>
                  </div>

                  <DropdownMenu.Group className="py-1">
                    <DropdownMenu.Item asChild>
                      <Link href="/profile" className="flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-secondary))] cursor-pointer outline-none">
                        <UserIcon className="h-4 w-4" />
                        Личный кабинет
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <Link href="/orders" className="flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-secondary))] cursor-pointer outline-none">
                        <ShoppingBag className="h-4 w-4" />
                        Мои заказы
                      </Link>
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>

                  {isSeller && (
                    <DropdownMenu.Group className="py-1 border-t border-[hsl(var(--border-default))]">
                      <DropdownMenu.Item asChild>
                        <Link href="/seller" className="flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-[hsl(var(--color-secondary))] hover:bg-[hsl(var(--color-secondary-light))] cursor-pointer outline-none font-medium">
                          <Settings className="h-4 w-4" />
                          Панель продавца
                        </Link>
                      </DropdownMenu.Item>
                    </DropdownMenu.Group>
                  )}

                  {isAdmin && (
                    <DropdownMenu.Group className="py-1 border-t border-[hsl(var(--border-default))]">
                      <DropdownMenu.Item asChild>
                        <Link href="/admin" className="flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))] cursor-pointer outline-none font-medium">
                          <Shield className="h-4 w-4" />
                          Панель администратора
                        </Link>
                      </DropdownMenu.Item>
                    </DropdownMenu.Group>
                  )}

                  <DropdownMenu.Separator className="h-px bg-[hsl(var(--border-default))] my-1" />
                  
                  <DropdownMenu.Item 
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error-light))] cursor-pointer outline-none"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">Войти</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">Регистрация</Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger menu button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-full hover:bg-[hsl(var(--bg-secondary))] md:hidden transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-[hsl(var(--text-primary))]" /> : <Menu className="h-5 w-5 text-[hsl(var(--text-primary))]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-elevated))] px-4 py-4 animate-scale-in">
          <form onSubmit={handleSearchSubmit} className="relative w-full mb-4">
            <input
              type="search"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pr-10 w-full"
            />
            <button type="submit" className="absolute right-3 top-3 text-[hsl(var(--text-tertiary))]">
              <Search className="h-4 w-4" />
            </button>
          </form>

          <nav className="flex flex-col gap-3 font-medium">
            <Link 
              href="/search" 
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "py-2 px-3 rounded-lg hover:bg-[hsl(var(--bg-secondary))]",
                pathname === '/search' ? "text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))]" : "text-[hsl(var(--text-secondary))]"
              )}
            >
              Каталог
            </Link>
            <Link 
              href="/about" 
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "py-2 px-3 rounded-lg hover:bg-[hsl(var(--bg-secondary))]",
                pathname === '/about' ? "text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))]" : "text-[hsl(var(--text-secondary))]"
              )}
            >
              О нас
            </Link>

            {!isAuthenticated && (
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[hsl(var(--border-default))]">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                  <Button variant="outline" className="w-full">Войти</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="w-full">
                  <Button variant="primary" className="w-full">Регистрация</Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
