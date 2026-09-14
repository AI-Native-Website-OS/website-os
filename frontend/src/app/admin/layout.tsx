import { Suspense } from 'react';
import type { Metadata } from 'next';
import AdminLayout from './admin-layout';

export const metadata: Metadata = {
  title: {
    default: '后台管理',
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
