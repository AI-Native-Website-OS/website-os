import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/stats/conversion');

export default function ConversionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
