'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mail, Phone, KeyRound, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Form State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    if (!email || !phone || !password || !confirmPassword) {
      setErrorMsg('Пожалуйста, заполните все поля.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    try {
      const payload = { 
        email, 
        phone: phone.startsWith('+') ? phone : `+998${phone.replace(/\D/g, '')}`,
        password,
        role: role === 'buyer' ? 'customer' : 'seller'
      };

      const res = await api.post<{
        user: { id: string; email: string; phone?: string; roles: string[] };
        token: string;
      }>('/auth/register', payload);

      if (res && res.user && res.token) {
        setAuth(res.user, res.token);
        router.push(role === 'seller' ? '/seller' : '/');
      } else {
        // Fallback session
        const mockUser = { id: 'mock-user-reg', email, phone, roles: [role] };
        setAuth(mockUser, 'mock-jwt-token');
        router.push(role === 'seller' ? '/seller' : '/');
      }
    } catch (err) {
      console.error('Registration error:', err);
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Ошибка регистрации. Попробуйте еще раз.');
      } else {
        // Offline demo fallback
        console.warn('API connection failed. Registering mock session.');
        const mockUser = {
          id: 'mock-user-reg',
          email,
          phone,
          roles: [role]
        };
        setAuth(mockUser, 'mock-jwt-token-val');
        router.push(role === 'seller' ? '/seller' : '/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-[hsl(var(--border-default))] shadow-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center text-[hsl(var(--text-primary))]">
          Регистрация
        </CardTitle>
        <CardDescription className="text-center text-xs text-[hsl(var(--text-secondary))]">
          Создайте аккаунт для покупок или продаж оборудования
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          
          {/* Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[hsl(var(--color-error-light))] border border-[hsl(var(--color-error)/0.15)] text-[hsl(var(--color-error))] text-xs font-semibold animate-scale-in">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[hsl(var(--text-secondary))]">Тип аккаунта</label>
            <div className="grid grid-cols-2 gap-2 bg-[hsl(var(--bg-secondary))] p-1 rounded-xl border border-[hsl(var(--border-default))]">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  role === 'buyer' 
                    ? 'bg-[hsl(var(--bg-primary))] text-[hsl(var(--color-primary))] shadow-sm border border-[hsl(var(--border-default))]' 
                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Покупатель
              </button>
              <button
                type="button"
                onClick={() => setRole('seller')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  role === 'seller' 
                    ? 'bg-[hsl(var(--bg-primary))] text-[hsl(var(--color-secondary))] shadow-sm border border-[hsl(var(--border-default))]' 
                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Продавец
              </button>
            </div>
          </div>

          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[hsl(var(--text-secondary))]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[hsl(var(--text-tertiary))]" />
              <Input
                type="email"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {/* Phone field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[hsl(var(--text-secondary))]">Телефон (с кодом +998)</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 h-4 w-4 text-[hsl(var(--text-tertiary))]" />
              <Input
                type="tel"
                placeholder="+998 (90) 123-45-67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[hsl(var(--text-secondary))]">Пароль</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[hsl(var(--text-tertiary))]" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[hsl(var(--text-secondary))]">Повтор пароля</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[hsl(var(--text-tertiary))]" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] border-0 text-white font-bold h-11 shadow-md hover:opacity-90"
            loading={loading}
          >
            Зарегистрироваться
          </Button>

          <div className="text-center text-xs text-[hsl(var(--text-secondary))]">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-bold text-[hsl(var(--color-primary))] hover:underline">
              Войти
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
