import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai-website');

export default function AiWebsiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}