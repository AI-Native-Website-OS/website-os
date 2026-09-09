'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { DashboardStats, ContentCategory } from '@/types';
import { FileText, Eye, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

const COLORS = ['#000000', '#333333', '#666666', '#999999', '#cccccc'];

export default function ContentAnalysis() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.stats.dashboard(),
      adminApi.stats.contentCategories(),
    ]).then(([s, c]) => {
      setStats(s.data);
      setCategories(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  const totalContent = categories.reduce((sum, c) => sum + c.count, 0);
  const totalViews = categories.reduce((sum, c) => sum + c.views, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.stats.contentTitle')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: t('admin.ui.stats.contentCardTotal'), value: totalContent, icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: t('admin.ui.stats.contentCardTodayViews'), value: stats?.todayViews || 0, icon: Eye, color: 'bg-green-50 text-green-600' },
          { label: t('admin.ui.stats.contentCardTotalViews'), value: totalViews.toLocaleString(), icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">{card.label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p></div>
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.contentDist')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categories} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="count">
                {categories.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {categories.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.name}</span>
                <span className="font-medium">{t('admin.ui.stats.itemCount').replace('{n}', String(item.count))}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.contentViewsRank')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="views" fill="#000000" radius={[0, 4, 4, 0]} name={t('admin.ui.stats.barNameViews')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats?.topPages && stats.topPages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.hotPages')}</h3>
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
