'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import api from '@/lib/api';
import type { SiteNotice } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nProvider';

const NOTICE_STYLES: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle },
};

const DISMISSED_STORAGE_KEY = 'dismissed_notice_ids';

function readLocalDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalDismissed(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export default function SiteNoticeBanner() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [notices, setNotices] = useState<SiteNotice[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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

  const userId = user?.id;

  // 登录后：把匿名期间关闭的记录合并到账号，并改为以后端记录为准；未登录时读取本地记录
  useEffect(() => {
    const local = readLocalDismissed();
    setDismissed(new Set(local));
    if (!userId || local.length === 0) return;
    api
      .post('/notices/dismissals/merge', local)
      .then(() => {
        writeLocalDismissed([]);
        setDismissed(new Set());
        load();
      })
      .catch(() => {});
  }, [userId, load]);

  const dismiss = useCallback(
    async (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      if (user) {
        try {
          await api.post(`/notices/${encodeURIComponent(id)}/dismiss`);
        } catch {
          /* 失败时后端仍会返回该通知，下次加载即恢复显示 */
        }
      } else {
        writeLocalDismissed(Array.from(new Set([...readLocalDismissed(), id])));
      }
    },
    [user]
  );

  const visible = notices.filter((notice) => !notice.id || !dismissed.has(String(notice.id)));

  if (visible.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 top-16 z-40 shadow-sm">
      {visible.map((notice, index) => {
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
            {notice.id && (
              <button
                type="button"
                onClick={() => dismiss(String(notice.id))}
                aria-label={t('publicComp.close')}
                title={t('publicComp.close')}
                className="shrink-0 p-1 rounded transition-colors hover:bg-black/5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
