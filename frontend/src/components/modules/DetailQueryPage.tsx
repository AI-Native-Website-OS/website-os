'use client';

import { useSearchParams } from 'next/navigation';
import PageState from '@/components/PageState';
import { ModuleDetailView } from '@/components/modules/ModuleDetailView';

export function DetailQueryPage() {
  const params = useSearchParams();
  const moduleKey = params.get('moduleKey') || '';
  const slug = params.get('slug') || '';
  const categorySlug = params.get('categorySlug') || undefined;

  if (!moduleKey || !slug) return <PageState error="缺少参数" />;
  return <ModuleDetailView moduleKey={moduleKey} slug={slug} categorySlug={categorySlug} />;
}
