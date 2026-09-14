'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import SeoHead from '@/components/SeoHead';
import { useI18n } from '@/i18n/I18nProvider';
import { isValidPhone, isValidEmail } from '@/lib/validators';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    realName: '',
    phone: '',
    code: '',
    email: '',
    companyName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { register, sendSmsCode } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!isValidPhone(form.phone)) {
      setError('请输入正确的11位手机号');
      return;
    }
    setError('');
    try {
      const devCode = await sendSmsCode(form.phone);
      setCountdown(60);
      if (devCode) {
        setError(`开发模式验证码：${devCode}`);
      }
    } catch (err: any) {
      setError(err?.message || '验证码发送失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (!isValidPhone(form.phone)) {
      setError('请输入正确的11位手机号');
      return;
    }
    if (!form.code) {
      setError('请输入短信验证码');
      return;
    }
    if (form.email && !isValidEmail(form.email)) {
      setError('请输入正确的邮箱地址');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username,
        password: form.password,
        phone: form.phone,
        code: form.code,
        realName: form.realName || undefined,
        email: form.email || undefined,
        companyName: form.companyName || undefined,
      });
      router.push('/login');
    } catch (err: any) {
      setError(err?.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <SeoHead title={t('auth.registerTitle')} description="注册账号。" path="/register" />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/">
            <img src="/logo.png" alt="logo" className="h-12 w-auto mx-auto" />
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-black">{t('auth.registerAccount')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="text-black font-medium hover:underline">
              {t('auth.goLogin')}
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.username')} *</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder={t('auth.enterUsername')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')} *</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder={t('auth.enterPassword')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.confirmPassword')} *</label>
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder={t('auth.enterConfirmPassword')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.realName')}</label>
              <input
                type="text"
                value={form.realName}
                onChange={(e) => updateField('realName', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder="请输入真实姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.phone')} *</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="block flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                  placeholder={t('auth.enterPhone')}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-black hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : t('auth.sendCode')}
                </button>
              </div>
              {form.phone && !isValidPhone(form.phone) && <p className="text-xs text-red-500 mt-1">请输入正确的11位手机号</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.verificationCode')} *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => updateField('code', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder={t('auth.enterCode')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder="请输入邮箱"
              />
              {form.email && !isValidEmail(form.email) && <p className="text-xs text-red-500 mt-1">请输入正确的邮箱地址</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.companyName')}</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                placeholder={t('auth.enterCompanyName')}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.registering') : t('auth.registerTitle')}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
