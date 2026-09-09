'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

interface UserVisitItem {
  userId: number;
  username: string;
  realName?: string;
  visitCount: number;
}

export default function TrafficSourceChart({
  data,
  loading,
}: {
  data: UserVisitItem[];
  loading: boolean;
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-20 mb-4" />
        <div className="h-[240px] bg-gray-50 rounded-lg" />
      </div>
    );
  }

  const top = data.slice(0, 10);

  const chartData = top.map(d => ({
    ...d,
    displayLabel: d.realName || d.username || t('common.guest'),
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-5">{t('admin.ui.dashboard.sourceTitle')}</h3>
      {data.length === 0 ? (
        <p className="text-gray-300 text-sm py-16 text-center">{t('common.empty')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1a1' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="displayLabel" tick={{ fontSize: 11, fill: '#525252' }} width={90} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: 'none', fontSize: 13 }}
              formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, t('admin.ui.dashboard.sourceVisits')]}
              labelFormatter={(label, payload) => {
                if (!payload?.length) return label;
                const d = payload[0].payload;
                return `${d.displayLabel}（${d.username}）`;
              }}
            />
            <Bar dataKey="visitCount" radius={[0, 3, 3, 0]} fill="#d4d4d4" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
