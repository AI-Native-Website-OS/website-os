import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai/model-config');

export default function ModelConfigLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
