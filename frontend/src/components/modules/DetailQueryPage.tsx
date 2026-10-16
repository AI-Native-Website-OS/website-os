'use client';

import { useSearchParams } from 'next/navigation';
import PageState from '@/components/PageState';
import { ModuleDetailView } from '@/components/modules/ModuleDetailView';
import { useI18n } from '@/i18n/I18nProvider';

export function DetailQueryPage() {
  const params = useSearchParams();
  const { t } = useI18n();
  const moduleKey = params.get('moduleKey') || '';
  const slug = params.get('slug') || '';
  const categorySlug = params.get('categorySlug') || undefined;

  if (!moduleKey || !slug) return <PageState error={t('publicPages.detailQuery.missingParam')} />;
  return <ModuleDetailView moduleKey={moduleKey} slug={slug} categorySlug={categorySlug} />;
}
