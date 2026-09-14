'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Landmark, Briefcase, FileCheck, BarChart3, Cpu, Handshake } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nProvider';

const identityOptions = [
  { key: 'government', icon: Landmark, titleKey: 'auth.identity.government', href: '/list/category?moduleKey=solutions' },
  { key: 'soe', icon: Briefcase, titleKey: 'auth.identity.soe', href: '/list/category?moduleKey=solutions' },
  { key: 'agency', icon: FileCheck, titleKey: 'auth.identity.agency', href: '/list/category?moduleKey=solutions' },
  { key: 'data', icon: BarChart3, titleKey: 'auth.identity.data', href: '/list/category?moduleKey=solutions' },
  { key: 'ai', icon: Cpu, titleKey: 'auth.identity.ai', href: '/list/category?moduleKey=products' },
  { key: 'partner', icon: Handshake, titleKey: 'auth.identity.partner', href: '/about' },
];

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'password' | 'sms'>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState('/');
  const { login, loginByCode, sendSmsCode } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)redirect=([^;]*)/);
    const redirect = match ? decodeURIComponent(match[1]) : '/';
    setRedirectTo(redirect);
    document.cookie = 'redirect=; path=/; max-age=0';
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    try {
      const devCode = await sendSmsCode(phone);
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
    setLoading(true);
    try {
      if (mode === 'sms') {
        await loginByCode(phone, code);
      } else {
        await login(username, password);
      }
      if (selectedIdentity) {
        localStorage.setItem('userIdentityKey', selectedIdentity);
      }
      const redirectTarget = selectedIdentity
        ? identityOptions.find(o => o.key === selectedIdentity)?.href || '/'
        : redirectTo;
      router.push(redirectTarget);
    } catch (err: any) {
      setError(err?.message || '登录失败，请检查输入');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SeoHead title={t('auth.loginTitle')} description="登录账号。" path="/login" />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-black">{t('auth.loginAccount')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="text-black font-medium hover:underline">
              {t('auth.registerNow')}
            </Link>
          </p>
        </div>

        <div className="glass-strong rounded-2xl p-5">
          <p className="text-sm text-gray-500 mb-3 text-center">{t('auth.chooseIdentity')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {identityOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedIdentity(selectedIdentity === opt.key ? null : opt.key)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                  selectedIdentity === opt.key
                    ? 'border-black bg-black text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:shadow-sm'
                }`}
              >
                <opt.icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium leading-tight">{t(opt.titleKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex rounded-xl bg-gray-100 p-1">
          {([
            { key: 'password', label: t('auth.passwordLogin') },
            { key: 'sms', label: t('auth.phoneLogin') },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { setMode(m.key); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="space-y-3">
            {mode === 'sms' ? (
              <>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.phone')}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                    placeholder={t('auth.enterPhone')}
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.verificationCode')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="code"
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="block flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                      placeholder={t('auth.enterCode')}
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
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.username')}
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                    placeholder={t('auth.enterUsername')}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('auth.password')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                    placeholder={t('auth.enterPassword')}
                  />
                </div>
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.loggingIn') : selectedIdentity ? t('auth.loginAndEnter') : t('auth.loginTitle')}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
