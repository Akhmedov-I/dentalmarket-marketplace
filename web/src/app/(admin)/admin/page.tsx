'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  BarChart3, 
  Store, 
  UserCheck, 
  Gavel, 
  Activity, 
  ShieldCheck, 
  FileSpreadsheet,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const stats = [
    { title: 'Общий GMV платформы', value: '1,420,500,000 UZS', desc: '+24% по сравнению с прошлым мес.', icon: BarChart3, color: 'text-blue-500' },
    { title: 'Доход платформы (комиссии)', value: '71,025,000 UZS', desc: 'Эффективная ставка ~5%', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Активных продавцов', value: '48', desc: '12 новых за эту неделю', icon: Store, color: 'text-indigo-500' },
    { title: 'Ожидают KYC / Сертификатов', value: '6 / 15', desc: 'Требуется ручная проверка', icon: AlertOctagon, color: 'text-amber-500' },
  ];

  const quickActions = [
    { name: 'Проверить KYC продавцов', desc: 'Проверка юр. лиц и реквизитов', count: '6 заявок', href: '/admin/sellers', icon: UserCheck, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { name: 'Сертификаты Минздрава', desc: 'Модерация медицинских документов', count: '15 на проверке', href: '/admin/certifications', icon: ShieldCheck, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { name: 'Разрешение споров', desc: 'Жалобы, возвраты, арбитраж сделок', count: '2 открыто', href: '/admin/disputes', icon: Gavel, color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
    { name: 'Отчёты и статистика', desc: 'Выгрузка транзакций и реестров', count: 'Готовы', href: '/admin/finances', icon: FileSpreadsheet, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  ];

  const auditLogs = [
    { id: 'a-9812', timestamp: '12:05:14', actor: 'system', action: 'reconciliation', target: 'ledger', details: 'Nightly ledger reconciliation complete. GMV sum matches balances.', type: 'info' },
    { id: 'a-9811', timestamp: '11:42:30', actor: 'admin@dentalmarket.uz', action: 'cert_verify', target: 'certification:82', details: 'Certificate verified for Product ID #Ajax-AJ15', type: 'success' },
    { id: 'a-9810', timestamp: '10:15:02', actor: 'seller:142', action: 'product_create', target: 'product:381', details: 'Product created: Woodpecker scaler (status: pending_cert)', type: 'warning' },
    { id: 'a-9809', timestamp: '09:00:00', actor: 'system', action: 'cert_expiry_check', target: 'products', details: 'Scanned 1420 certificates. 3 expired, listings suspended.', type: 'info' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Page Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-[hsl(var(--text-primary))]">
          Панель управления платформой
        </h1>
        <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">
          Контроль транзакций, модерация продавцов, сертификатов Минздрава и мониторинг финансового реестра.
        </p>
      </div>

      {/* Stats Cards Grid */}
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

      {/* Quick Actions Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Быстрые действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <div 
                key={idx} 
                className={`p-5 rounded-2xl border border-[hsl(var(--border-default))] flex flex-col justify-between h-40 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${act.color}`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-xl bg-white/60 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-md shadow-xs">
                    {act.count}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold mt-3 leading-tight">{act.name}</h3>
                  <p className="text-[10px] opacity-80 mt-1 leading-normal">{act.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audit Log Monitor */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Журнал аудита системы (Режим реального времени)</h2>
          <Button variant="link" size="sm" className="text-xs gap-1.5 pr-0">
            Полный лог
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Card className="border border-[hsl(var(--border-default))] overflow-hidden">
          <div className="divide-y divide-[hsl(var(--border-default))] font-medium text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-[hsl(var(--bg-secondary))] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="text-[10px] text-[hsl(var(--text-tertiary))] font-mono">{log.timestamp}</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[hsl(var(--bg-secondary))] border border-[hsl(var(--border-default))] font-semibold text-[10px]">
                    <Activity className="h-3 w-3 text-indigo-500" />
                    {log.actor}
                  </span>
                  <span className="font-bold text-[hsl(var(--text-primary))]">
                    {log.action}
                  </span>
                  <span className="text-[hsl(var(--text-secondary))] text-xs">
                    {log.details}
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))]">ID: {log.id}</span>
                  <span className={`h-2 w-2 rounded-full ${
                    log.type === 'success' ? 'bg-emerald-500' : (log.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500')
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

    </div>
  );
}
