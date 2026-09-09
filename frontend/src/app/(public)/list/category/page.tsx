import { Suspense } from 'react';
import PageState from '@/components/PageState';
import { CategoryQueryPage } from '@/components/modules/CategoryQueryPage';

export default function ListCategoryPage() {
  return (
    <Suspense fallback={<PageState loading />}>
      <CategoryQueryPage />
    </Suspense>
  );
}
