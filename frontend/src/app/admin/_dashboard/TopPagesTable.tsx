'use client';

import { useI18n } from '@/i18n/I18nProvider';

interface TopPageDetail {
  pageUrl: string;
  pageType: string;
  pageTitle?: string;
  viewCount: number;
  maxCount: number;
}

const TYPE_BADGES: Record<string, string> = {
  home: 'bg-gray-100 text-gray-700',
  product: 'bg-blue-50 text-blue-700',
  solution: 'bg-green-50 text-green-700',
  case: 'bg-purple-50 text-purple-700',
  article: 'bg-orange-50 text-orange-700',
  whitepaper: 'bg-teal-50 text-teal-700',
  about: 'bg-gray-100 text-gray-700',
  faq: 'bg-pink-50 text-pink-700',
  'ai-facts': 'bg-indigo-50 text-indigo-700',
};

function getBadge(pageType: string) {
  return TYPE_BADGES[pageType?.toLowerCase()] || 'bg-gray-100 text-gray-500';
}

function safeDecode(text: string): string {
  try { return decodeURIComponent(text); } catch { return text; }
}

function stripTrailingDigits(text: string): string {
  return text.replace(/\d+$/, '');
}

function makeDisplayTitle(item: TopPageDetail, t: (k: string) => string): string {
  if (item.pageTitle) return safeDecode(stripTrailingDigits(item.pageTitle));
  if (!item.pageUrl || item.pageUrl === '/') return t('admin.ui.dashboard.pageType.home');
  const parts = item.pageUrl.split('/').filter(Boolean);
  const last = stripTrailingDigits(safeDecode(parts[parts.length - 1]));
  return last.length > 30 ? last.slice(0, 30) + '...' : last;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  home: 'admin.ui.dashboard.pageType.home',
  product: 'admin.ui.dashboard.pageType.product',
  solution: 'admin.ui.dashboard.pageType.solution',
  case: 'admin.ui.dashboard.pageType.case',
  article: 'admin.ui.dashboard.pageType.article',
  whitepaper: 'admin.ui.dashboard.pageType.whitepaper',
  about: 'admin.ui.dashboard.pageType.about',
  faq: 'admin.ui.dashboard.pageType.faq',
  'ai-facts': 'admin.ui.dashboard.pageType.ai-facts',
};

function pageTypeLabel(pageType: string, t: (k: string) => string): string {
  const key = PAGE_TYPE_LABELS[pageType?.toLowerCase()];
  if (key) return t(key);
  return pageType || t('admin.ui.dashboard.pageType.other');
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
                <th className="text-left py-2.5 pr-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesType')}</th>
                <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesPage')}</th>
                <th className="text-right py-2.5 pl-3 text-gray-400 font-medium text-xs">{t('admin.ui.dashboard.topPagesViews')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => {
                const badge = getBadge(item.pageType);
                const pct = item.maxCount > 0 ? Math.round((item.viewCount / item.maxCount) * 100) : 0;
                return (
                  <tr key={idx} className="border-b border-gray-50/80 group">
                    <td className="py-3 pr-3">
                      <span className={`inline-block px-1.5 py-0.5 text-[11px] font-medium rounded ${badge}`}>
                        {pageTypeLabel(item.pageType, t)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-gray-900 text-xs font-medium truncate max-w-[220px] group-hover:text-gray-700 transition-colors" title={item.pageUrl}>
                        {makeDisplayTitle(item, t)}
                      </div>
                      <div className="text-gray-300 text-[11px] font-mono truncate max-w-[220px]" title={item.pageUrl}>
                        {item.pageUrl}
                      </div>
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-300 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 text-right w-12 tabular-nums">
                          {item.viewCount.toLocaleString()}
                        </span>
                      </div>
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
