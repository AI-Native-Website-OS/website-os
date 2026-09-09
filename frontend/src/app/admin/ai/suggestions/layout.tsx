import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai/suggestions');

export default function SuggestionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
