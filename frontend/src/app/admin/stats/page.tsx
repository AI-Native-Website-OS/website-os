'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { DashboardStats } from '@/types';
import { Eye, Users, FileText, Download, MessageSquare, ClipboardList, TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export default function AdminStats() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);
  const loadStats = async () => { try { const res = await adminApi.stats.dashboard(); setStats(res.data); } catch (err) { console.error(err); } finally { setLoading(false); } };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  const statCards = [
    { label: t('admin.ui.stats.cardTodayPv'), value: stats?.todayViews || 0, icon: Eye, color: 'bg-blue-50 text-blue-600' },
    { label: t('admin.ui.stats.cardTodayUv'), value: stats?.todayUniqueVisitors || 0, icon: Users, color: 'bg-green-50 text-green-600' },
    { label: t('admin.ui.stats.cardTodayLeads'), value: stats?.todayLeads || 0, icon: ClipboardList, color: 'bg-purple-50 text-purple-600' },
    { label: t('admin.ui.stats.cardFormSubmits'), value: stats?.todayFormSubmits || 0, icon: FileText, color: 'bg-orange-50 text-orange-600' },
    { label: t('admin.ui.stats.cardDownloads'), value: stats?.todayDownloads || 0, icon: Download, color: 'bg-pink-50 text-pink-600' },
    { label: t('admin.ui.stats.cardAiChats'), value: stats?.todayAiChats || 0, icon: MessageSquare, color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.stats.title')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">{card.label}</p><p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p></div>
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="w-6 h-6" /></div>
            </div>
          </div>
        ))}
      </div>

      {stats?.topPages && stats.topPages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-gray-500" /><h2 className="text-lg font-semibold text-gray-900">{t('admin.ui.stats.topPagesTitle')}</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200"><th className="text-left py-3 px-4 text-gray-500 font-medium">{t('admin.ui.stats.colRank')}</th><th className="text-left py-3 px-4 text-gray-500 font-medium">{t('admin.ui.stats.colPageType')}</th><th className="text-left py-3 px-4 text-gray-500 font-medium">{t('admin.ui.stats.colPageUrl')}</th><th className="text-right py-3 px-4 text-gray-500 font-medium">{t('admin.ui.stats.colViews')}</th></tr></thead>
              <tbody>
                {stats.topPages.map((page, idx) => (
                  <tr key={idx} className="border-b border-gray-100"><td className="py-3 px-4 font-medium">{idx + 1}</td><td className="py-3 px-4">{page.pageType === 'home' ? t('admin.ui.stats.pageTypeHome') : page.pageType}</td><td className="py-3 px-4 font-mono text-xs max-w-[200px] truncate" title={page.pageUrl}>{page.pageTitle || page.pageUrl}</td><td className="py-3 px-4 text-right font-bold">{page.viewCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
