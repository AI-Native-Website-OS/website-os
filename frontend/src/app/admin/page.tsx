'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import type { DashboardStats, TrendPoint, HourlyPoint } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import OverviewCards from './_dashboard/OverviewCards';
import TrafficChart from './_dashboard/TrafficChart';
import TrafficSourceChart from './_dashboard/TrafficSourceChart';
import TopPagesTable from './_dashboard/TopPagesTable';
import LeadPipeline from './_dashboard/LeadPipeline';

interface LinePoint { date: string; pv: number; uv: number }

const safe = <T,>(p: Promise<any>, fallback: T): Promise<T> =>
  p.then(r => r.data as T).catch(() => fallback);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [cards, setCards] = useState<{ label: string; value: string; icon: string }[]>([]);
  const [trafficData, setTrafficData] = useState<LinePoint[]>([]);
  const [trafficRange, setTrafficRange] = useState('7d');
  const [sourcePageData, setSourcePageData] = useState<{ userId: number; username: string; realName?: string; visitCount: number }[]>([]);
  const [topPages, setTopPages] = useState<{ pageUrl: string; pageType: string; viewCount: number; maxCount: number }[]>([]);

  const fetchTraffic = useCallback(async (range: string) => {
    if (range === 'today') {
      const h = await safe<HourlyPoint[]>(adminApi.stats.hourlyDistribution(), []);
      if (h.length > 0) {
        setTrafficData(h.map(d => ({ date: `${d.hour}:00`, pv: d.visits, uv: 0 })));
        return;
      }
    }
    if (range === '7d') {
      const w = await safe<TrendPoint[]>(adminApi.stats.weeklyTrend(), []);
      if (w.length > 0) {
        setTrafficData(w.map(d => ({ date: d.date?.slice(5) ?? d.date, pv: d.pageViews, uv: d.uniqueVisitors })));
        return;
      }
    }
    setTrafficData([]);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [s, srcPages] = await Promise.all([
        safe<DashboardStats | null>(adminApi.stats.dashboard(), null),
        safe<any[]>(adminApi.stats.pageUrlDistribution(), []),
      ]);

      setCards([
        { label: t('admin.ui.dashboard.cardTodayPv'), value: (s?.todayViews || 0).toLocaleString(), icon: 'Eye' },
        { label: t('admin.ui.dashboard.cardTodayUv'), value: (s?.todayUniqueVisitors || 0).toLocaleString(), icon: 'Users' },
        { label: t('admin.ui.dashboard.cardTodayLeads'), value: (s?.todayLeads || 0).toLocaleString(), icon: 'UserPlus' },
        { label: t('admin.ui.dashboard.cardTotalResources'), value: (s?.totalResources || 0).toLocaleString(), icon: 'FileText' },
      ]);

      setSourcePageData(
        (srcPages as any[]).length > 0
          ? (srcPages as any[]).map(p => ({
              userId: p.user_id || p.id || 0,
              username: p.username || t('common.guest'),
              realName: p.real_name || undefined,
              visitCount: p.visit_count || 0,
            }))
          : []
      );

      if (s?.topPages?.length) {
        const pages = (s.topPages as any[]).slice(0, 10);
        const maxCount = Math.max(...pages.map(p => p.view_count || 0), 1);
        setTopPages(
          pages.map(p => ({
            pageUrl: p.page_url || '/',
            pageType: p.page_type || 'other',
            pageTitle: p.page_title || undefined,
            viewCount: p.view_count || 0,
            maxCount,
          }))
        );
      }

      await fetchTraffic('7d');
      setLoading(false);
    };
    load();
  }, [fetchTraffic, t]);

  const handleRangeChange = useCallback((range: string) => {
    setTrafficRange(range);
    fetchTraffic(range);
  }, [fetchTraffic]);

  if (loading) {
    return (
      <div>
        <div className="mb-1">
          <h1 className="text-lg font-semibold text-gray-900">{t('admin.ui.dashboard.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('admin.ui.dashboard.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200/80 px-5 py-4 animate-pulse">
              <div className="flex justify-between mb-1.5"><div className="h-3.5 bg-gray-100 rounded w-14" /><div className="h-5 w-5 bg-gray-100 rounded" /></div>
              <div className="h-7 bg-gray-100 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-20 mb-4" /><div className="h-[300px] bg-gray-50 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map(i => <div key={i} className="bg-white rounded-lg border border-gray-200/80 p-5 animate-pulse"><div className="h-4 bg-gray-100 rounded w-20 mb-4" /><div className="h-[200px] bg-gray-50 rounded-lg" /></div>)}
        </div>
        <div className="mt-6 bg-white rounded-lg border border-gray-200/80 p-5 animate-pulse"><div className="h-4 bg-gray-100 rounded w-20 mb-4" /><div className="h-[120px] bg-gray-50 rounded-lg" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">{t('admin.ui.dashboard.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('admin.ui.dashboard.subtitle')}</p>
      </div>
      <OverviewCards data={cards} />
      <TrafficChart data={trafficData} range={trafficRange} onRangeChange={handleRangeChange} loading={false} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TrafficSourceChart data={sourcePageData} loading={false} />
        <TopPagesTable data={topPages} loading={false} />
      </div>
      <div className="mt-6">
        <LeadPipeline />
      </div>
    </div>
  );
}
