'use client';

import React from 'react';
import Link from 'next/link';
import { Stethoscope, Send } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[hsl(222_47%_11%)] text-[hsl(220_13%_91%)] border-t border-[hsl(222_47%_25%)]">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Column 1: Brand details */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white shadow-md">
                <Stethoscope className="h-4.5 w-4.5" />
              </div>
              <span className="gradient-text text-lg font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))]">
                DentalMarket
              </span>
            </Link>
            <p className="text-xs text-[hsl(220_14%_70%)] leading-relaxed max-w-[240px]">
              Профессиональная b2b-платформа для стоматологического оборудования, инструментов и расходных материалов в Узбекистане.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="p-2 rounded-full bg-[hsl(222_47%_18%)] hover:bg-[hsl(var(--color-primary))] transition-all duration-300 text-white" aria-label="Telegram">
                <Send className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-full bg-[hsl(222_47%_18%)] hover:bg-[hsl(var(--color-primary))] transition-all duration-300 text-white" aria-label="Facebook">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a href="#" className="p-2 rounded-full bg-[hsl(222_47%_18%)] hover:bg-[hsl(var(--color-primary))] transition-all duration-300 text-white" aria-label="Instagram">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: About company */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              О компании
            </h4>
            <ul className="space-y-2.5 text-xs text-[hsl(220_14%_70%)]">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">О нас</Link>
              </li>
              <li>
                <Link href="/contacts" className="hover:text-white transition-colors">Контакты</Link>
              </li>
              <li>
                <Link href="/vacancies" className="hover:text-white transition-colors">Вакансии</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">Блог</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customers */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Покупателям
            </h4>
            <ul className="space-y-2.5 text-xs text-[hsl(220_14%_70%)]">
              <li>
                <Link href="/search" className="hover:text-white transition-colors">Каталог товаров</Link>
              </li>
              <li>
                <Link href="/delivery" className="hover:text-white transition-colors">Доставка</Link>
              </li>
              <li>
                <Link href="/payment" className="hover:text-white transition-colors">Оплата</Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors">Возврат товара</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Sellers */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Продавцам
            </h4>
            <ul className="space-y-2.5 text-xs text-[hsl(220_14%_70%)]">
              <li>
                <Link href="/seller-onboarding" className="hover:text-white transition-colors">Стать продавцом</Link>
              </li>
              <li>
                <Link href="/commissions" className="hover:text-white transition-colors">Комиссии и тарифы</Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">Поддержка</Link>
              </li>
              <li>
                <Link href="/terms-seller" className="hover:text-white transition-colors">Правила платформы</Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="border-t border-[hsl(222_47%_18%)] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[hsl(220_14%_70%)]">
          <p>© {new Date().getFullYear()} DentalMarket. Все права защищены.</p>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <Link href="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Условия использования</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
