'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const { locale, setLocale } = useI18n();
  const isEn = locale === 'en';
  return (
    <button
      type="button"
      onClick={() => setLocale(isEn ? 'zh' : 'en')}
      title={isEn ? '切换为中文' : 'Switch to English'}
      className={`flex items-center gap-1 text-sm font-medium transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 shrink-0 whitespace-nowrap ${
        light ? 'text-gray-600 hover:text-black' : 'text-gray-600 hover:text-black'
      }`}
    >
      <Globe className="w-4 h-4" />
      <span className="select-none">{isEn ? '中文' : 'EN'}</span>
    </button>
  );
}