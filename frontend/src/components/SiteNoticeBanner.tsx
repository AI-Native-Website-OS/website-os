'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import type { SiteNotice } from '@/types';

const NOTICE_STYLES: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle },
};

export default function SiteNoticeBanner() {
  const [notices, setNotices] = useState<SiteNotice[]>([]);

  const load = useCallback(() => {
    api
      .get('/home/notices')
      .then((res: any) => setNotices(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('site-config-changed', load);
    return () => window.removeEventListener('site-config-changed', load);
  }, [load]);

  if (notices.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 top-16 z-40 shadow-sm">
      {notices.map((notice, index) => {
        const style = NOTICE_STYLES[notice.type] || NOTICE_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={notice.id || index}
            className={`flex items-start gap-3 px-4 py-3 border-b ${style.bg} ${style.border} ${style.text}`}
            role="status"
          >
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-sm whitespace-pre-wrap break-words">
              {notice.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
