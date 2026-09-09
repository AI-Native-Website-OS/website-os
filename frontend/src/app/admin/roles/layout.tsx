import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/roles');

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
