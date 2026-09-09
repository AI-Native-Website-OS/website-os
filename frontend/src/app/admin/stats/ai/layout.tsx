import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/stats/ai');

export default function StatsAiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
