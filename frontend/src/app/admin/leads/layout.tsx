import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/leads');

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
