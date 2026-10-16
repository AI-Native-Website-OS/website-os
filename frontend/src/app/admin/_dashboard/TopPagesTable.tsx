'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { safeDecode, stripTrailingDigits, urlToDisplayTitle } from '@/lib/pageDisplay';

interface TopPageDetail {
  pageUrl: string;
  pageType: string;
  pageTitle?: string;
  viewCount: number;
  maxCount: number;
  avgDuration: number;
}

function makeDisplayTitle(item: TopPageDetail, t: (k: string) => string): string {
  if (item.pageTitle) return safeDecode(stripTrailingDigits(item.pageTitle));
  return urlToDisplayTitle(item.pageUrl, t('admin.ui.dashboard.pageType.home'));
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

export default function TopPagesTable({
  data,
  loading,
}: {
  data: TopPageDetail[];
  loading: boolean;
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-20 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('admin.ui.dashboard.topPagesTitle')}</h3>
      {data.length === 0 ? (
        <p className="text-gray-300 text-sm py-16 text-center">{t('common.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2.5 pr-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesPage')}</th>
                <th className="text-right py-2.5 px-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesViews')}</th>
                <th className="text-right py-2.5 pl-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => {
                const pct = item.maxCount > 0 ? Math.round((item.viewCount / item.maxCount) * 100) : 0;
                return (
                  <tr key={idx} className="border-b border-gray-50/80 group">
                    <td className="py-3 pr-3">
                      <div className="text-gray-900 text-xs font-medium truncate max-w-[260px] group-hover:text-gray-700 transition-colors" title={item.pageUrl}>
                        {makeDisplayTitle(item, t)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-300 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 text-right w-12 tabular-nums">
                          {item.viewCount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right text-sm text-gray-600 tabular-nums w-16">
                      {formatDuration(item.avgDuration)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
