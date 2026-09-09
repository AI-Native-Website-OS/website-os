import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/user-center');

export default function UserCenterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
