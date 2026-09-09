import type { Metadata } from 'next';
import { pageMetadataTemplate } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadataTemplate('/admin/ai');

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
