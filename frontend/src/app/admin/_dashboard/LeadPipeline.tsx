'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface StageItem {
  id: number;
  name: string;
  company?: string;
  source: string;
  score: number;
}

interface Stage {
  status: string;
  label: string;
  count: number;
  recent: StageItem[];
}

const STAGE_COLORS: Record<string, { bg: string; dot: string; bar: string }> = {
  new: { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500' },
  contacted: { bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', bar: 'bg-yellow-500' },
  qualified: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', bar: 'bg-green-500' },
  quoted: { bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', bar: 'bg-purple-500' },
  closed: { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  invalid: { bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', bar: 'bg-gray-400' },
};

const TOTAL_LABELS: Record<string, string> = {
  ai_chat: 'admin.ui.dashboard.pipelineSource.ai_chat',
  page_click: 'admin.ui.dashboard.pipelineSource.page_click',
  registration: 'admin.ui.dashboard.pipelineSource.registration',
  form: 'admin.ui.dashboard.pipelineSource.form',
  'demo-booking': 'admin.ui.dashboard.pipelineSource.demo-booking',
};

export default function LeadPipeline() {
  const { t } = useI18n();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats.leadPipeline()
      .then(res => setStages(res.data?.stages || []))
      .catch(() => setStages([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 bg-gray-100 rounded w-24 mb-4 animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 h-40 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (stages.length === 0) return null;

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{t('admin.ui.dashboard.pipelineTitle')}</h3>
        <Link href="/admin/leads" className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-black transition-colors">
          {t('common.viewAll')} <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {stages.map(stage => {
          const colors = STAGE_COLORS[stage.status] || STAGE_COLORS.new;
          return (
            <div key={stage.status} className={`flex-shrink-0 w-52 rounded-lg border ${colors.bg} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-xs font-medium text-gray-700">{stage.label}</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stage.count}</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-1.5 mb-3">
                <div className={`h-1.5 rounded-full ${colors.bar} transition-all`} style={{ width: `${(stage.count / maxCount) * 100}%` }} />
              </div>
              <div className="space-y-1.5">
                {stage.recent.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-2">{t('admin.ui.dashboard.pipelineEmpty')}</p>
                ) : (
                  stage.recent.map(item => (
                    <div key={item.id} className="bg-white/80 rounded-md px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{item.name}</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${(item.score || 0) >= 80 ? 'bg-green-100 text-green-700' : (item.score || 0) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{item.company || '-'}</span>
                        <span className="text-[9px] text-gray-400">{t(TOTAL_LABELS[item.source] || item.source)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}