'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { DashboardStats, NameValueItem, MonthlyTrend } from '@/types';
import { ClipboardList, FileText, Download, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

export default function ConversionAnalysis() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [funnel, setFunnel] = useState<NameValueItem[]>([]);
  const [sources, setSources] = useState<NameValueItem[]>([]);
  const [leadTrend, setLeadTrend] = useState<MonthlyTrend[]>([]);
  const [submitTrend, setSubmitTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.stats.dashboard(),
      adminApi.stats.conversionFunnel(),
      adminApi.stats.leadSources(),
      adminApi.stats.monthlyLeadTrend(),
      adminApi.stats.monthlySubmissionTrend(),
    ]).then(([s, f, src, lt, st]) => {
      setStats(s.data);
      setFunnel(f.data);
      setSources(src.data);
      setLeadTrend(lt.data);
      setSubmitTrend(st.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  const totalSourceLeads = sources.reduce((sum, s) => sum + s.value, 0);

  const mergedTrend = leadTrend.map(lt => ({
    month: lt.month,
    leads: lt.leads,
    submits: submitTrend.find(st => st.month === lt.month)?.submits || 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.stats.conversionTitle')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: t('admin.ui.stats.convCardTodayLeads'), value: stats?.todayLeads || 0, icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
          { label: t('admin.ui.stats.convCardFormSubmits'), value: stats?.todayFormSubmits || 0, icon: FileText, color: 'bg-green-50 text-green-600' },
          { label: t('admin.ui.stats.convCardDownloads'), value: stats?.todayDownloads || 0, icon: Download, color: 'bg-purple-50 text-purple-600' },
          { label: t('admin.ui.stats.convCardRate'), value: `${stats?.todayLeads && stats?.todayFormSubmits ? ((stats.todayLeads / Math.max(stats.todayFormSubmits, 1)) * 100).toFixed(1) : 0}%`, icon: Target, color: 'bg-orange-50 text-orange-600' },
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.funnelTitle')}</h3>
          <div className="space-y-3 mt-4">
            {funnel.length > 0 && funnel.map((item, idx) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.name}</span>
                  <span className="font-medium">{item.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${(item.value / funnel[0].value) * 100}%`, backgroundColor: idx === 0 ? '#000' : idx === 1 ? '#333' : idx === 2 ? '#666' : '#999' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.sourceTitle')}</h3>
          <div className="space-y-4 mt-4">
            {sources.map(item => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.name}</span>
                  <span className="font-medium">{item.value}{totalSourceLeads > 0 ? ` (${(item.value / totalSourceLeads * 100).toFixed(1)}%)` : ''}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-black h-2 rounded-full" style={{ width: totalSourceLeads > 0 ? `${(item.value / totalSourceLeads * 100)}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.monthTrendTitle')}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={mergedTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="submits" fill="#999999" radius={[4, 4, 0, 0]} name={t('admin.ui.stats.barSubmits')} />
            <Bar dataKey="leads" fill="#000000" radius={[4, 4, 0, 0]} name={t('admin.ui.stats.barLeads')} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
