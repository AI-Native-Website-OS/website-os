'use client';

import { useSearchParams } from 'next/navigation';
import PageState from '@/components/PageState';
import { ModuleListView } from '@/components/modules/ModuleListView';
import { useI18n } from '@/i18n/I18nProvider';

export function CategoryQueryPage() {
  const params = useSearchParams();
  const { t } = useI18n();
  const moduleKey = params.get('moduleKey') || '';
  const categorySlug = params.get('categorySlug') || undefined;

  if (!moduleKey) return <PageState error={t('publicPages.categoryQuery.missingModule')} />;
  return <ModuleListView moduleKey={moduleKey} categorySlug={categorySlug} />;
}
