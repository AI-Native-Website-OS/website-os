import type { Metadata } from 'next';
import PublicLayout from './public-layout';

export const metadata: Metadata = {
  title: {
    default: '首页',
    template: '%s - 圣诺江苏官网',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
