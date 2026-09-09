import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/stats/content');

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
