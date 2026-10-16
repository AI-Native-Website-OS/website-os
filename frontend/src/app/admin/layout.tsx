import { Suspense } from 'react';
import type { Metadata } from 'next';
import AdminLayout from './admin-layout';
import { t } from '@/i18n/translate';

export const metadata: Metadata = {
  title: {
    default: t('common.admin'),
    template: '%s',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
      <AdminLayout>{children}</AdminLayout>
    </Suspense>
  );
}
