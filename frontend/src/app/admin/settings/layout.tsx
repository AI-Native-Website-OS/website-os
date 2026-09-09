import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/settings');

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
