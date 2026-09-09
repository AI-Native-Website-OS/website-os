'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleListView } from '@/components/modules/ModuleListView';
import { ModuleDetailView } from '@/components/modules/ModuleDetailView';
import PageState from '@/components/PageState';

export default function ShellPage() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <PageState loading />;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    return <ModuleListView moduleKey={segments[0]} />;
  }
  if (segments.length === 2) {
    return <ModuleDetailView moduleKey={segments[0]} slug={segments[1]} />;
  }
  return <PageState error="页面不存在" />;
}
