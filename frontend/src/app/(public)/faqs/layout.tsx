import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/faqs');

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
