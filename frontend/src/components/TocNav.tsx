'use client';

import { useEffect, useState } from 'react';
import { List } from 'lucide-react';
import type { TocItem } from '@/types';

interface TocNavProps {
  content: string;
}

export default function TocNav({ content }: TocNavProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const headings = doc.querySelectorAll('h2, h3');
    const toc: TocItem[] = [];
    headings.forEach((h, i) => {
      const id = `toc-${i}`;
      h.setAttribute('id', id);
      toc.push({ id, text: h.textContent || '', level: h.tagName === 'H2' ? 2 : 3 });
    });
    setItems(toc);
  }, [content]);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (items.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-2xl p-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left font-semibold text-gray-900 mb-3"
      >
        <List className="w-4 h-4" />
        目录导航
      </button>
      {!collapsed && (
        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`block w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${
                item.level === 3 ? 'pl-6' : ''
              } ${
                activeId === item.id
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
            >
              {item.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
