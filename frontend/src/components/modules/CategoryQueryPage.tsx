'use client';

import { useSearchParams } from 'next/navigation';
import PageState from '@/components/PageState';
import { ModuleListView } from '@/components/modules/ModuleListView';

export function CategoryQueryPage() {
  const params = useSearchParams();
  const moduleKey = params.get('moduleKey') || '';
  const categorySlug = params.get('categorySlug') || undefined;

  if (!moduleKey) return <PageState error="缺少模块参数" />;
  return <ModuleListView moduleKey={moduleKey} categorySlug={categorySlug} />;
}
