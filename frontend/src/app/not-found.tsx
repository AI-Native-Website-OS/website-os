import Link from 'next/link';
import { t } from '@/i18n/translate';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-black mb-2">404</h1>
        <p className="text-lg text-gray-500 mb-8">{t('publicHome.notFoundMessage')}</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="btn-primary">
            {t('publicHome.backHome')}
          </Link>
          <Link href="/about" className="btn-outline">
            {t('publicHome.contactUs')}
          </Link>
        </div>
      </div>
    </div>
  );
}
