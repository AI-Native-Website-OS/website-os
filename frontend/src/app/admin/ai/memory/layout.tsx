import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai/memory');

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
