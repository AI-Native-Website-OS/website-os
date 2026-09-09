import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/login');

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
