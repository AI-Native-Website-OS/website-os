import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/permissions');

export default function PermissionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
