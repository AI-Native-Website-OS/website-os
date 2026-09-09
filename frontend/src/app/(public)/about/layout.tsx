import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/about');

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
