import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/api-docs');

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
