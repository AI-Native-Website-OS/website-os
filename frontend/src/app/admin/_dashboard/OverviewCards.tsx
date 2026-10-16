'use client';

import { Eye, Users, UserPlus, FileText, Download, MessageSquare, ClipboardList, TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

const ICON_MAP: Record<string, LucideIcon> = {
  Eye, Users, UserPlus, FileText, Download, MessageSquare, ClipboardList,
};

export interface OverviewCardData {
  label: string;
  value: string;
  icon: string;
  change?: number | null;
}

function ChangeChip({ change }: { change: number | null }) {
  const { t } = useI18n();
  if (change === null) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <span className="text-[11px] font-medium text-gray-300">—</span>
        <span className="text-[11px] text-gray-400">{t('admin.ui.dashboard.vsYesterday')}</span>
      </div>
    );
  }
  const up = change > 0;
  const flat = change === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-1 mt-2">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
          flat ? 'text-gray-400' : up ? 'text-green-600' : 'text-red-500'
        )}
      >
        <Icon className="w-3 h-3" />
        {flat ? '0%' : `${Math.abs(change).toFixed(1)}%`}
      </span>
      <span className="text-[11px] text-gray-400">{t('admin.ui.dashboard.vsYesterday')}</span>
    </div>
  );
}

export default function OverviewCards({ data }: { data: OverviewCardData[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
      {data.map((card) => {
        const Icon = ICON_MAP[card.icon] || Eye;
        return (
          <div
            key={card.label}
            className="group bg-white rounded-lg border border-gray-200/80 px-4 py-4 hover:border-gray-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors truncate">{card.label}</span>
              <div className="p-1 rounded-md text-gray-400 group-hover:text-gray-600 transition-colors shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums tracking-tight">{card.value}</p>
            {card.change !== undefined && <ChangeChip change={card.change} />}
          </div>
        );
      })}
    </div>
  );
}
