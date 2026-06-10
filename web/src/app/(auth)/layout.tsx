'use client';

import React from 'react';
import Link from 'next/link';
import { Stethoscope } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-tr from-[hsl(222_47%_11%)] via-[hsl(221_83%_15%)] to-[hsl(168_76%_12%)] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background visual details */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>
      
      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in">
        {/* Logo at the top */}
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-2 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Stethoscope className="h-6 w-6 animate-pulse-glow" />
            </div>
            <span className="gradient-text text-2xl font-black tracking-tight bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))]">
              DentalMarket
            </span>
          </Link>
          <p className="text-xs text-[hsl(220_14%_70%)] font-medium">Панель авторизации пользователей</p>
        </div>

        {/* Auth page contents */}
        {children}
      </div>
    </div>
  );
}
