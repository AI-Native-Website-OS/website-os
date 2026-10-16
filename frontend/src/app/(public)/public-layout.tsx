'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import SiteNoticeBanner from '@/components/SiteNoticeBanner';
import { useTracking } from '@/hooks/useTracking';

function TrackingProvider() {
  useTracking();
  return null;
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <SiteNoticeBanner />
      {children}
      <Suspense fallback={null}>
        <TrackingProvider />
      </Suspense>
    </>
  );
}
