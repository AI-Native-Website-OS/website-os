'use client';

import Header from '@/components/Header';
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
      {children}
      <TrackingProvider />
    </>
  );
}
