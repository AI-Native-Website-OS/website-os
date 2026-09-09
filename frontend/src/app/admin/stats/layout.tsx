import type { Metadata } from 'next';
import { pageMetadataTemplate } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadataTemplate('/admin/stats');

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
