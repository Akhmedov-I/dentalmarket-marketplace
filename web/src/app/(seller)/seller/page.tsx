'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Package, 
  Star, 
  AlertCircle, 
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SellerDashboard() {
  const stats = [
    { title: 'Заказов сегодня', value: '14', desc: '+15% по сравнению с вчера', icon: Clock, color: 'text-blue-500' },
    { title: 'Выручка за месяц', value: '45,800,000 UZS', desc: '+8.4% по сравнению с прошлым', icon: TrendingUp, color: 'text-emerald-500' },
    { title: 'Активных товаров', value: '86', desc: '14 блокировано сертификатами', icon: Package, color: 'text-amber-500' },
    { title: 'Рейтинг дилера', value: '4.85 / 5', desc: 'На основе 124 отзывов', icon: Star, color: 'text-yellow-500' },
  ];

  const recentOrders = [
    { id: '10082', customer: 'Клиника \"Zygoma Dental\"', product: 'Ajax AJ15 Установка', price: '85,000,000 сум', status: 'В доставке', statusColor: 'bg-blue-100 text-blue-800' },
    { id: '10081', customer: 'Доктор Каримов Т. А.', product: 'Набор наконечников KAVO', price: '6,200,000 сум', status: 'Ожидает отправки', statusColor: 'bg-amber-100 text-amber-800' },
    { id: '10080', customer: 'ООО \"Медикус-Азия\"', product: 'Альгинатная масса Hydrogum (x10)', price: '1,500,000 сум', status: 'Выполнен', statusColor: 'bg-emerald-100 text-emerald-800' },
    { id: '10079', customer: 'Стоматология \"Шифо-Нур\"', product: 'Портативный рентген Genoray', price: '32,000,000 сум', status: 'Выполнен', statusColor: 'bg-emerald-100 text-emerald-800' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Welcome Message */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-[hsl(var(--text-primary))]">
          Добро пожаловать в кабинет партнера!
        </h1>
        <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">
          Здесь вы можете управлять вашими товарами, сертификатами соответствия Минздрава и заказами.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border border-[hsl(var(--border-default))]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <span className="text-xs font-bold text-[hsl(var(--text-secondary))]">{stat.title}</span>
                <Icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-xl font-extrabold text-[hsl(var(--text-primary))]">{stat.value}</div>
                <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1 font-semibold">{stat.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Main Sections - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Recent Orders */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Последние заказы</h2>
            <Button variant="link" size="sm" className="text-xs gap-1.5 pr-0">
              Все заказы
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Card className="border border-[hsl(var(--border-default))] overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs text-[hsl(var(--text-secondary))] border-collapse">
                <thead className="bg-[hsl(var(--bg-secondary))] text-[hsl(var(--text-primary))] font-bold border-b border-[hsl(var(--border-default))]">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Клиент</th>
                    <th className="p-4">Товары</th>
                    <th className="p-4">Сумма</th>
                    <th className="p-4 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border-default))] font-medium text-[hsl(var(--text-primary))]">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[hsl(var(--bg-secondary))/0.5] transition-colors">
                      <td className="p-4 font-bold text-[hsl(var(--color-primary))]">#{order.id}</td>
                      <td className="p-4">{order.customer}</td>
                      <td className="p-4 truncate max-w-[200px]">{order.product}</td>
                      <td className="p-4 font-semibold">{order.price}</td>
                      <td className="p-4 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${order.statusColor}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Right Column: Certification Summary */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Статус соответствия</h2>
          
          <Card className="border border-[hsl(var(--border-default))]">
            <CardHeader className="border-b border-[hsl(var(--border-default))]">
              <CardTitle className="text-sm font-bold">Сертификаты Минздрава</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              {/* Stat rows */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-[hsl(var(--text-primary))]">12 одобрено</div>
                  <div className="text-[10px] text-[hsl(var(--text-secondary))] font-medium">Беспрепятственная торговля</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-[hsl(var(--text-primary))]">2 на проверке</div>
                  <div className="text-[10px] text-[hsl(var(--text-secondary))] font-medium">Модерация от 1 до 3 рабочих дней</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-[hsl(var(--text-primary))]">3 отклонено</div>
                  <div className="text-[10px] text-[hsl(var(--text-secondary))] font-medium">Требуется загрузить документы</div>
                </div>
              </div>

              <div className="pt-4 border-t border-[hsl(var(--border-default))]">
                <Button className="w-full text-xs font-semibold" variant="outline">
                  Загрузить сертификат
                </Button>
              </div>

            </CardContent>
          </Card>
        </section>

      </div>

    </div>
  );
}
