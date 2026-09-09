import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai/prompts');

export default function PromptsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
