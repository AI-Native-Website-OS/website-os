import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/home');

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
