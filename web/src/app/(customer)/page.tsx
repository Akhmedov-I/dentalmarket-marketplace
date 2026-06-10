'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Truck, 
  Award, 
  ArrowRight, 
  Stethoscope, 
  Activity, 
  Layers, 
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const categories = [
    {
      id: 'equipment',
      title: 'Оборудование',
      description: 'Стоматологические установки, рентген-аппараты, автоклавы.',
      icon: Stethoscope,
      color: 'from-blue-500/20 to-indigo-500/20',
      badge: 'Премиум'
    },
    {
      id: 'instruments',
      title: 'Инструменты',
      description: 'Терапевтические, хирургические и ортопедические инструменты.',
      icon: Activity,
      color: 'from-emerald-500/20 to-teal-500/20',
      badge: 'В наличии'
    },
    {
      id: 'materials',
      title: 'Расходные материалы',
      description: 'Пломбировочные материалы, оттискные массы, анестетики.',
      icon: Layers,
      color: 'from-amber-500/20 to-orange-500/20',
      badge: 'Хит'
    }
  ];

  const benefits = [
    {
      title: '100% Сертификация',
      description: 'Все товары проходят проверку соответствия медицинским стандартам Узбекистана.',
      icon: Award,
    },
    {
      title: 'Безопасная сделка (Эскроу)',
      description: 'Продавец получает деньги только после успешной доставки и проверки товара покупателем.',
      icon: ShieldCheck,
    },
    {
      title: 'Быстрая экспресс-доставка',
      description: 'Специальные условия доставки хрупкого медицинского оборудования по всей стране.',
      icon: Truck,
    }
  ];

  const stats = [
    { value: '1000+', label: 'Товаров в каталоге' },
    { value: '150+', label: 'Проверенных дилеров' },
    { value: '99.5%', label: 'Довольных клиентов' }
  ];

  return (
    <div className="w-full space-y-16 pb-20 overflow-hidden">
      
      {/* 1. Hero Section */}
      <section className="relative min-h-[500px] flex items-center justify-center bg-gradient-to-tr from-[hsl(222_47%_11%)] via-[hsl(221_83%_15%)] to-[hsl(168_76%_12%)] py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-25"></div>
        <div className="container relative z-10 mx-auto text-center max-w-4xl space-y-6 animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[hsl(var(--color-secondary))] text-xs font-semibold">
            <Sparkles className="h-3 w-3 animate-spin" />
            B2B Маркетплейс нового поколения
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Профессиональное <span className="bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))]">стоматологическое</span> оборудование
          </h1>
          <p className="text-base sm:text-lg text-[hsl(220_14%_80%)] max-w-2xl mx-auto font-normal">
            Сертифицированная медицинская техника, инструменты и расходные материалы напрямую от проверенных дистрибьюторов с защитой сделок.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/search">
              <Button size="lg" className="w-full sm:w-auto font-semibold gap-2 shadow-lg bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] hover:opacity-90 border-0 text-white">
                Каталог товаров
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-white border-white/20 hover:bg-white/5 bg-transparent font-medium">
                Подробнее о платформе
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Featured Categories */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-2 text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
            Популярные категории
          </h2>
          <p className="text-sm text-[hsl(var(--text-secondary))] max-w-md mx-auto">
            Исследуйте наш ассортимент от расходников до сложного лечебного оборудования.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link key={cat.id} href={`/search?category=${cat.id}`} className="block group">
                <Card className="h-full border border-[hsl(var(--border-default))] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-[hsl(var(--color-primary)/0.4)] group-hover:shadow-lg overflow-hidden flex flex-col justify-between">
                  <CardHeader className="relative pb-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${cat.color} text-[hsl(var(--color-primary))] mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="absolute top-6 right-6 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]">
                      {cat.badge}
                    </span>
                    <CardTitle className="text-xl group-hover:text-[hsl(var(--color-primary))] transition-colors">
                      {cat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 flex-grow text-sm text-[hsl(var(--text-secondary))]">
                    {cat.description}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Benefits (Why DentalMarket) */}
      <section className="bg-[hsl(var(--bg-secondary))] py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
              Почему DentalMarket?
            </h2>
            <p className="text-sm text-[hsl(var(--text-secondary))] max-w-md mx-auto">
              Мы разработали надёжные механизмы защиты для обеспечения прозрачности и безопасности каждой покупки.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center p-6 bg-[hsl(var(--bg-primary))] rounded-2xl border border-[hsl(var(--border-default))] shadow-sm transition-all hover:shadow-md">
                  <div className="w-14 h-14 rounded-full bg-[hsl(var(--color-primary-light))] flex items-center justify-center text-[hsl(var(--color-primary))] mb-5">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold text-[hsl(var(--text-primary))] mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Animated Stats Counter */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white rounded-3xl p-10 md:p-14 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="space-y-2 border-b md:border-b-0 md:border-r border-white/20 last:border-0 pb-6 md:pb-0 md:pr-4">
                <div className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-white/90 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
    </div>
  );
}
