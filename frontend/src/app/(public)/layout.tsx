import type { Metadata } from 'next';
import PublicLayout from './public-layout';

export const metadata: Metadata = {
  title: {
    default: '首页',
    template: '%s',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
