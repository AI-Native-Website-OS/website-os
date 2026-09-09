import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/seo');

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
