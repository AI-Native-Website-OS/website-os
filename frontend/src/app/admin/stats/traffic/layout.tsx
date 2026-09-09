import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/stats/traffic');

export default function TrafficLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
