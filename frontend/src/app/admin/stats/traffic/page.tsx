'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { DashboardStats, TrendPoint, HourlyPoint } from '@/types';
import { Eye, Users, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

export default function TrafficAnalysis() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.stats.dashboard(),
      adminApi.stats.weeklyTrend(),
      adminApi.stats.hourlyDistribution(),
    ]).then(([s, t, h]) => {
      setStats(s.data);
      setTrend(t.data);
      setHourly(h.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.stats.trafficTitle')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: t('admin.ui.stats.trafficCardPv'), value: stats?.todayViews || 0, icon: Eye, color: 'bg-blue-50 text-blue-600' },
          { label: t('admin.ui.stats.trafficCardUv'), value: stats?.todayUniqueVisitors || 0, icon: Users, color: 'bg-green-50 text-green-600' },
          { label: t('admin.ui.stats.trafficCardSubmits'), value: stats?.todayFormSubmits || 0, icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.weekTrend')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend.map(d => ({ ...d, name: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="pageViews" stroke="#000000" strokeWidth={2} name={t('admin.ui.stats.lineNameViews')} />
              <Line type="monotone" dataKey="uniqueVisitors" stroke="#666666" strokeWidth={2} name={t('admin.ui.stats.lineNameVisitors')} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.hourlyDist')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourly.map(h => ({ ...h, name: `${h.hour}:00` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="visits" fill="#000000" radius={[4, 4, 0, 0]} name={t('admin.ui.stats.barNameVisits')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
