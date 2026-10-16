'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

const RANGES = [
  { key: 'today', label: 'admin.ui.dashboard.rangeToday' },
  { key: 'yesterday', label: 'admin.ui.dashboard.rangeYesterday' },
  { key: '7d', label: 'admin.ui.dashboard.range7d' },
  { key: '30d', label: 'admin.ui.dashboard.range30d' },
];

const METRICS: { key: string; label: string; color: string; axis: 'left' | 'right' }[] = [
  { key: 'pv', label: 'admin.ui.dashboard.metricPv', color: '#171717', axis: 'left' },
  { key: 'uv', label: 'admin.ui.dashboard.metricUv', color: '#a3a3a3', axis: 'left' },
  { key: 'leads', label: 'admin.ui.dashboard.metricLeads', color: '#2563eb', axis: 'right' },
  { key: 'downloads', label: 'admin.ui.dashboard.metricDownloads', color: '#16a34a', axis: 'right' },
  { key: 'aiChats', label: 'admin.ui.dashboard.metricAiChats', color: '#d97706', axis: 'right' },
];

interface Point { date: string; pv: number; uv: number; leads: number; downloads: number; aiChats: number }

export default function TrafficChart({
  data,
  range,
  onRangeChange,
  loading,
}: {
  data: Point[];
  range: string;
  onRangeChange: (r: string) => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState<Record<string, boolean>>({
    pv: true, uv: true, leads: true, downloads: true, aiChats: true,
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-24 mb-4" />
        <div className="h-[300px] bg-gray-50 rounded-lg" />
      </div>
    );
  }

  const isHourly = range === 'today' || range === 'yesterday';

  const totalPv = data.reduce((s, d) => s + (d.pv || 0), 0);
  const totalUv = data.reduce((s, d) => s + (d.uv || 0), 0);
  const avgPv = data.length ? Math.round(totalPv / data.length) : 0;

  const summary = isHourly
    ? [
        { label: t('admin.ui.dashboard.summaryPv'), value: totalPv },
        { label: t('admin.ui.dashboard.summaryUv'), value: totalUv },
      ]
    : [
        { label: t('admin.ui.dashboard.summaryPv'), value: totalPv },
        { label: t('admin.ui.dashboard.summaryUv'), value: totalUv },
        { label: t('admin.ui.dashboard.summaryDailyAvg'), value: avgPv },
      ];

  const hasRightMetrics = METRICS.some(m => m.axis === 'right' && visible[m.key]);

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md text-gray-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.ui.dashboard.trafficTitle')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setVisible(v => ({ ...v, [m.key]: !v[m.key] }))}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-150',
                  visible[m.key] ? 'border-gray-300 text-gray-800' : 'border-transparent text-gray-300'
                )}
              >
                <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: visible[m.key] ? m.color : '#d4d4d4' }} />
                {t(m.label)}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => onRangeChange(r.key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150',
                  range === r.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                )}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-8 mb-5">
        {summary.map(item => (
          <div key={item.label}>
            <p className="text-[11px] text-gray-400 mb-0.5">{item.label}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{item.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="text-gray-300 text-sm py-16 text-center">{t('admin.ui.dashboard.trafficEmpty')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 4, right: hasRightMetrics ? 4 : 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} />
            {hasRightMetrics && (
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} allowDecimals={false} />
            )}
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: 'none', fontSize: 13 }}
              cursor={{ stroke: '#d4d4d4', strokeDasharray: '3 3' }}
            />
            {METRICS.map(m => visible[m.key] && (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={1.5}
                name={t(m.label)}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                yAxisId={m.axis}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
