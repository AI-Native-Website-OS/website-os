import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/users');

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
