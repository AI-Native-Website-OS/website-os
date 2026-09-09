'use client';

import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

const RANGES = [
  { key: 'today', label: 'admin.ui.dashboard.range24h' },
  { key: '7d', label: 'admin.ui.dashboard.range7d' },
];

export default function TrafficChart({
  data,
  range,
  onRangeChange,
  loading,
}: {
  data: { date: string; pv: number; uv: number }[];
  range: string;
  onRangeChange: (r: string) => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-24 mb-4" />
        <div className="h-[300px] bg-gray-50 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md text-gray-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.ui.dashboard.trafficTitle')}</h2>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => onRangeChange(r.key)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150',
                range === r.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-400 hover:text-gray-700'
              )}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-gray-300 text-sm py-16 text-center">{t('admin.ui.dashboard.trafficEmpty')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: 'none', fontSize: 13 }}
              cursor={{ stroke: '#d4d4d4', strokeDasharray: '3 3' }}
            />
            <Line type="monotone" dataKey="pv" stroke="#171717" strokeWidth={1.5} name="PV" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="uv" stroke="#a3a3a3" strokeWidth={1.5} name="UV" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
