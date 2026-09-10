'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl, shuffleArray } from '@/lib/utils';
import { detailUrl } from '@/lib/moduleConfig';

interface CarouselItem {
  type: 'product' | 'solution' | 'case' | 'whitepaper' | 'article';
  id: number;
  title: string;
  slug?: string;
  summary?: string;
  coverImage?: string;
  href: string;
}

const INTERVAL = 5000;

function fetchModule(moduleKey: string, type: 'product' | 'solution' | 'case' | 'article') {
  return api.get(`/content/${moduleKey}`, { params: { page: 1, size: 6 } }).then(r => {
    const list: any[] = r.data?.records || [];
    return list.slice(0, 3).map((p: any) => ({
      type, id: p.id, title: p.title, slug: p.slug,
      summary: p.summary, coverImage: p.coverImage,
      href: detailUrl(moduleKey, p.slug),
    }));
  }).catch(() => []);
}

export default function ContentCarousel() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    Promise.all([
      fetchModule('products', 'product'),
      fetchModule('solutions', 'solution'),
      fetchModule('cases', 'case'),
      fetchModule('resources', 'article'),
    ]).then(results => {
      const merged = shuffleArray(results.flat()).slice(0, 8);
      setItems(merged);
    });
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [items.length]);

  const goTo = useCallback((i: number) => setCurrent(i), []);

  if (items.length === 0) return null;

  const item = items[current];

  return (
    <div className="relative w-full max-w-3xl mx-auto mt-4">
      <div className="relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-sm">
        <Link href={item.href} className="flex items-stretch min-h-[80px] group">
          {item.coverImage && (
            <div className="w-24 flex-shrink-0 overflow-hidden">
              <img src={getImageUrl(item.coverImage)} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                item.type === 'product' ? 'bg-blue-100 text-blue-700' :
                item.type === 'solution' ? 'bg-purple-100 text-purple-700' :
                item.type === 'case' ? 'bg-green-100 text-green-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {item.type === 'product' ? '浜у搧' : item.type === 'solution' ? '鏂规' : item.type === 'case' ? '妗堜緥' : '璧勬簮'}
              </span>
              <span className="text-xs font-medium text-gray-900 truncate group-hover:text-black transition-colors">{item.title}</span>
            </div>
            {item.summary && (
              <p className="text-xs text-gray-500 line-clamp-1">{item.summary}</p>
            )}
          </div>
          <div className="flex items-center pr-3">
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Dots */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {items.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                i === current ? 'bg-black w-3' : 'bg-gray-300 hover:bg-gray-400'
              }`} />
          ))}
        </div>
      )}
    </div>
  );
}
