'use client';

import { Loader2, AlertCircle, Inbox } from 'lucide-react';

interface PageStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
}

export default function PageState({ loading, error, empty, emptyMessage = '暂无数据', children }: PageStateProps) {
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <AlertCircle className="w-10 h-10" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Inbox className="w-10 h-10" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
