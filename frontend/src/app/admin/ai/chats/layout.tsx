import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata('/admin/ai/chats');

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
