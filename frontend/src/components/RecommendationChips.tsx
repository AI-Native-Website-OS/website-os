'use client';

import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import type { ContentRecommendation } from '@/types';

interface RecommendationChipsProps {
  items?: ContentRecommendation[];
}

export default function RecommendationChips({ items }: RecommendationChipsProps) {
  const links = (items || []).filter((it) => !!it?.url);
  if (links.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((it, i) => (
        <Link
          key={`${it.moduleKey}-${it.slug}-${it.id ?? i}`}
          href={it.url as string}
          className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[220px]">{it.title || it.moduleName}</span>
          <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
