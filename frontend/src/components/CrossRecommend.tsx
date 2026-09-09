'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Package, LayoutGrid, Award, FileText, Layers, ArrowRight } from 'lucide-react';
import type { ContentItem, ContentRelations, CoreModule } from '@/types';
import { getImageUrl, formatDate } from '@/lib/utils';
import { detailUrl } from '@/lib/moduleConfig';
import api from '@/lib/api';

interface CrossRecommendProps {
  relations?: ContentRelations;
  variant?: 'full' | 'sidebar';
}

interface CardItem {
  id: number;
  href: string;
  title: string;
  summary?: string;
  coverImage?: string;
  date?: string;
  categoryLabel: string;
  categoryIcon: React.ReactNode;
}

const BUILTIN_ICONS: Record<string, React.ReactNode> = {
  products: <Package className="w-4 h-4" />,
  solutions: <LayoutGrid className="w-4 h-4" />,
  cases: <Award className="w-4 h-4" />,
  resources: <FileText className="w-4 h-4" />,
};

function Card({ item }: { item: CardItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <Link
        href={item.href}
        className="group block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-300"
      >
        {item.coverImage && (
          <div className="relative h-36 overflow-hidden">
            <img
              src={getImageUrl(item.coverImage)}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <span className="absolute bottom-2 left-3 px-2 py-0.5 bg-white/90 text-gray-800 text-xs rounded font-medium">
              {item.categoryLabel}
            </span>
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {!item.coverImage && (
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-black transition-colors duration-300">
                <span className="text-gray-600 group-hover:text-white transition-colors duration-300">
                  {item.categoryIcon}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              {!item.coverImage && (
                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded mb-2 font-medium">
                  {item.categoryLabel}
                </span>
              )}
              <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-black">
                {item.title}
              </h3>
              {item.summary && (
                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2 transition-all duration-300 group-hover:text-black group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SidebarSection({ label, items }: { label: string; items: CardItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-black">{label}</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block p-5 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
          >
            {item.coverImage && (
              <img src={getImageUrl(item.coverImage)} alt={item.title} className="w-full h-32 object-cover rounded-lg mb-3" />
            )}
            <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{item.title}</p>
            {item.date && <p className="text-xs text-gray-400">{item.date}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Section({ label, icon, items }: { label: string; icon: React.ReactNode; items: CardItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{label}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function toCardItems(items: ContentItem[] | undefined, moduleKey: string, categoryLabel: string): CardItem[] | undefined {
  if (!items || items.length === 0) return undefined;
  const categoryIcon = BUILTIN_ICONS[moduleKey] || <Layers className="w-4 h-4" />;
  return items.map((item) => ({
    id: item.id,
    href: detailUrl(moduleKey, item.slug),
    title: item.title,
    summary: item.summary,
    coverImage: item.coverImage || undefined,
    date: formatDate(item.publishedAt ?? item.createdAt ?? ''),
    categoryLabel,
    categoryIcon,
  }));
}

export default function CrossRecommend({ relations, variant = 'full' }: CrossRecommendProps) {
  const [modules, setModules] = useState<CoreModule[]>([]);

  useEffect(() => {
    api.get('/core-modules').then((res: any) => setModules(res.data || [])).catch(() => {});
  }, []);

  const hasAny = Object.values(relations || {}).some((items) => items && items.length > 0);
  if (!hasAny) return null;

  const nameByKey = new Map<string, string>(modules.map((m) => [m.moduleKey, m.moduleName]));

  if (variant === 'sidebar') {
    return (
      <div className="space-y-8">
        {Object.entries(relations || {}).map(([moduleKey, items]) => {
          const cards = toCardItems(items, moduleKey, nameByKey.get(moduleKey) || moduleKey);
          if (!cards) return null;
          return (
            <SidebarSection
              key={moduleKey}
              label={`相关${nameByKey.get(moduleKey) || moduleKey}`}
              items={cards}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {Object.entries(relations || {}).map(([moduleKey, items]) => {
        const cards = toCardItems(items, moduleKey, nameByKey.get(moduleKey) || moduleKey);
        if (!cards) return null;
        return (
          <Section
            key={moduleKey}
            label={`相关${nameByKey.get(moduleKey) || moduleKey}`}
            icon={BUILTIN_ICONS[moduleKey] || <Layers className="w-4 h-4" />}
            items={cards}
          />
        );
      })}
    </div>
  );
}