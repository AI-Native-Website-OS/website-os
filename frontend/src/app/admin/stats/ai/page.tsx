'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { DashboardStats, ChatTrend } from '@/types';
import { MessageSquare, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

export default function AiAnalysis() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chatTrend, setChatTrend] = useState<ChatTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.stats.dashboard(),
      adminApi.stats.weeklyChatTrend(),
    ]).then(([s, c]) => {
      setStats(s.data);
      setChatTrend(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  const totalUsers = chatTrend.reduce((sum, d) => sum + d.users, 0);
  const avgUsers = chatTrend.length > 0 ? Math.round(totalUsers / chatTrend.length) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.stats.aiTitle')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: t('admin.ui.stats.aiCardTodayChats'), value: stats?.todayAiChats || 0, icon: MessageSquare, color: 'bg-blue-50 text-blue-600' },
          { label: t('admin.ui.stats.aiCardWeekChats'), value: chatTrend.reduce((s, d) => s + d.chats, 0), icon: MessageSquare, color: 'bg-green-50 text-green-600' },
          { label: t('admin.ui.stats.aiCardAvgUsers'), value: avgUsers, icon: Users, color: 'bg-purple-50 text-purple-600' },
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.chatTrend')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chatTrend.map(d => ({ ...d, name: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="chats" stroke="#000000" strokeWidth={2} name={t('admin.ui.stats.lineNameChats')} />
              <Line type="monotone" dataKey="users" stroke="#999999" strokeWidth={2} name={t('admin.ui.stats.lineNameUsers')} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.stats.dailyChats')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chatTrend.map(d => ({ ...d, name: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="chats" fill="#000000" radius={[4, 4, 0, 0]} name={t('admin.ui.stats.barNameChats')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
