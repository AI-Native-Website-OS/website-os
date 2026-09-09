'use client';

import { Eye, Users, UserPlus, FileText, LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Eye, Users, UserPlus, FileText,
};

export default function OverviewCards({
  data,
}: {
  data: { label: string; value: string; icon: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {data.map((card) => {
        const Icon = ICON_MAP[card.icon] || Eye;
        return (
          <div
            key={card.label}
            className="group bg-white rounded-lg border border-gray-200/80 px-5 py-4 hover:border-gray-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{card.label}</span>
              <div className="p-1.5 rounded-md text-gray-400 group-hover:text-gray-600 transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums tracking-tight">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
