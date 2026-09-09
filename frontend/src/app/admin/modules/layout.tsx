import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/modules');

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
