import { Suspense } from 'react';
import PageState from '@/components/PageState';
import { DetailQueryPage } from '@/components/modules/DetailQueryPage';

export default function ListCategoryDetailPage() {
  return (
    <Suspense fallback={<PageState loading />}>
      <DetailQueryPage />
    </Suspense>
  );
}
