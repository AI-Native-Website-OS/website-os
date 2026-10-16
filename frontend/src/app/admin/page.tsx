'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import type { DashboardStats, TrendPoint, HourlyPoint, ActivityPoint } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import OverviewCards, { OverviewCardData } from './_dashboard/OverviewCards';
import TrafficChart from './_dashboard/TrafficChart';
import GeoDistributionMap from './_dashboard/GeoDistributionMap';
import TrafficSourceChart from './_dashboard/TrafficSourceChart';
import TopPagesTable from './_dashboard/TopPagesTable';
import LeadPipeline from './_dashboard/LeadPipeline';

interface LinePoint { date: string; pv: number; uv: number; leads: number; downloads: number; aiChats: number }

type ActivityMap = Map<string, ActivityPoint>;

const safe = <T,>(p: Promise<any>, fallback: T): Promise<T> =>
  p.then(r => r.data as T).catch(() => fallback);

const buildHourly = (h: HourlyPoint[], act: ActivityMap): LinePoint[] => {
  const byHour = new Map(h.map(d => [Number(d.hour), d]));
  return Array.from({ length: 24 }, (_, hour) => {
    const d = byHour.get(hour);
    const a = act.get(String(hour));
    return {
      date: `${hour}:00`,
      pv: d?.visits ?? 0,
      uv: d?.uniqueVisitors ?? 0,
      leads: a?.leads ?? 0,
      downloads: a?.downloads ?? 0,
      aiChats: a?.aiChats ?? 0,
    };
  });
};

const buildDaily = (rows: TrendPoint[], act: ActivityMap): LinePoint[] =>
  rows.map(d => {
    const a = act.get(d.date);
    return {
      date: d.date?.slice(5) ?? d.date,
      pv: d.pageViews,
      uv: d.uniqueVisitors,
      leads: a?.leads ?? 0,
      downloads: a?.downloads ?? 0,
      aiChats: a?.aiChats ?? 0,
    };
  });

const pctChange = (curr?: number, prev?: number): number | null => {
  const c = curr || 0;
  const p = prev || 0;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / p) * 100;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [cards, setCards] = useState<OverviewCardData[]>([]);
  const [trafficData, setTrafficData] = useState<LinePoint[]>([]);
  const [trafficRange, setTrafficRange] = useState('7d');
  const [sourcePageData, setSourcePageData] = useState<{ userId: number; username: string; realName?: string; visitCount: number }[]>([]);
  const [topPages, setTopPages] = useState<{ pageUrl: string; pageType: string; viewCount: number; maxCount: number; avgDuration: number }[]>([]);

  const fetchTraffic = useCallback(async (range: string) => {
    const activity = await safe<ActivityPoint[]>(adminApi.stats.activityTrend(range), []);
    const act: ActivityMap = new Map(activity.map(a => [a.key, a]));

    if (range === 'today' || range === 'yesterday') {
      const h = await safe<HourlyPoint[]>(
        range === 'today' ? adminApi.stats.hourlyDistribution() : adminApi.stats.hourlyDistributionYesterday(),
        []
      );
      setTrafficData(buildHourly(h, act));
      return;
    }
    if (range === '7d') {
      const w = await safe<TrendPoint[]>(adminApi.stats.weeklyTrend(), []);
      setTrafficData(buildDaily(w, act));
      return;
    }
    if (range === '30d') {
      const m = await safe<TrendPoint[]>(adminApi.stats.trafficTrend30d(), []);
      setTrafficData(buildDaily(m, act));
      return;
    }
    setTrafficData([]);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [s, srcPages] = await Promise.all([
        safe<DashboardStats | null>(adminApi.stats.dashboard(), null),
        safe<any[]>(adminApi.stats.pageUrlDistribution(), []),
      ]);

      const n = (v?: number) => (v || 0).toLocaleString();

      setCards([
        { label: t('admin.ui.dashboard.cardTodayPv'), value: n(s?.todayViews), icon: 'Eye', change: pctChange(s?.todayViews, s?.yesterdayViews) },
        { label: t('admin.ui.dashboard.cardTodayUv'), value: n(s?.todayUniqueVisitors), icon: 'Users', change: pctChange(s?.todayUniqueVisitors, s?.yesterdayUniqueVisitors) },
        { label: t('admin.ui.dashboard.cardTodayLeads'), value: n(s?.todayLeads), icon: 'UserPlus', change: pctChange(s?.todayLeads, s?.yesterdayLeads) },
        { label: t('admin.ui.dashboard.cardTodayDownloads'), value: n(s?.todayDownloads), icon: 'Download', change: pctChange(s?.todayDownloads, s?.yesterdayDownloads) },
        { label: t('admin.ui.dashboard.cardTodayAiChats'), value: n(s?.todayAiChats), icon: 'MessageSquare', change: pctChange(s?.todayAiChats, s?.yesterdayAiChats) },
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
            avgDuration: Math.round(Number(p.avg_duration || 0)),
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200/80 px-4 py-4 animate-pulse">
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
      <GeoDistributionMap />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopPagesTable data={topPages} loading={false} />
        <TrafficSourceChart data={sourcePageData} loading={false} />
      </div>
      <div className="mt-6">
        <LeadPipeline />
      </div>
    </div>
  );
}
