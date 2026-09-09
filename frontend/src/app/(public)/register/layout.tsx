import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/register');

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
