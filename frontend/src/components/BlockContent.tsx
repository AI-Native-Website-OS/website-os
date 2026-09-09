'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import { HtmlBlockView } from '@/components/HtmlBlockView';

function IconComp({ name, className = 'w-5 h-5' }: { name?: string; className?: string }) {
  if (!name) return null;
  const C = (LucideIcons as any)[name];
  return C ? <C className={className} /> : null;
}

interface BlockContentProps {
  type: string;
  data: any;
}

/**
 * 按展示类型渲染区块内容体（不含外层 section/背景/标题）。
 * 抽取自 BlockRenderer，供首页区块与内容详情页复用。
 */
export function BlockContent({ type, data }: BlockContentProps) {
  switch (type) {
    case 'list': return <ListContent data={data} />;
    case 'module': return <ModuleContent data={data} />;
    case 'image_text': return <ImageTextContent data={data} />;
    case 'timeline': return <TimelineContent data={data} />;
    case 'rich_text': return <RichTextContent data={data} />;
    case 'html': return <HtmlContent data={data} />;
    case 'carousel': return <CarouselContent data={data} />;
    default: return null;
  }
}

// ─── 列表（表格展示） ─────────────────────────────────────
function ListContent({ data }: any) {
  const cols = (data.columns && data.columns.length > 0) ? data.columns : ['key', 'value'];
  const rows = data.rows || [];
  if (rows.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-6xl mx-auto">
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {cols.map((col: string, i: number) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {cols.map((col: string, ci: number) => {
                  const val = row[col];
                  return (
                    <td key={ci} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {val && val !== '-' ? val : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ─── 模块（支持单模块/多模块） ─────────────────────────────
function ModuleContent({ data }: any) {
  const items = data.items || [];

  const renderModuleCard = (mod: any, i: number) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.08 }}
      className="p-6 md:p-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-center"
    >
      {mod.icon && (
        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <IconComp name={mod.icon} className="w-6 h-6 text-white" />
        </div>
      )}
      {mod.title && <h3 className="text-lg font-semibold text-black mb-2">{mod.title}</h3>}
      {mod.subtitle && <p className="text-sm text-gray-400 mb-3">{mod.subtitle}</p>}
      {mod.description && <p className="text-sm text-gray-600 leading-relaxed">{mod.description}</p>}
    </motion.div>
  );

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-8 md:p-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-center"
        >
          {data.icon && (
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-md">
              <IconComp name={data.icon} className="w-7 h-7 text-white" />
            </div>
          )}
          {data.title && <h3 className="text-xl font-semibold text-black mb-2">{data.title}</h3>}
          {data.subtitle && <p className="text-sm text-gray-400 mb-4">{data.subtitle}</p>}
          {data.description && <p className="text-base text-gray-600 leading-relaxed">{data.description}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((mod: any, i: number) => renderModuleCard(mod, i))}
      </div>
    </div>
  );
}

// ─── 图文 ───────────────────────────────────────────────────
function ImageTextContent({ data }: any) {
  const groups = data.groups || [];
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {groups.map((g: any, i: number) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8`}
        >
          <div className="w-full md:w-1/2">
            {g.image && (
              <img src={getImageUrl(g.image)} alt="" className="w-full h-auto rounded-xl shadow-sm object-cover" />
            )}
          </div>
          <div className="w-full md:w-1/2">
            <p className="text-base text-gray-600 leading-relaxed">{g.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── 时间线 ─────────────────────────────────────────────────
function TimelineContent({ data }: any) {
  const timeline = data.timeline || [];

  function renderNodeContent(node: any) {
    return (
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        {node.date && <span className="text-xs font-bold text-black bg-gray-100 px-3 py-1 rounded-full inline-block mb-2">{node.date}</span>}
        {node.content && <p className="text-sm text-gray-700 leading-relaxed">{node.content}</p>}
        {node.tag && <span className="text-xs text-gray-400 mt-2 inline-block">{node.tag}</span>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-black via-gray-300 to-transparent md:-translate-x-px" />
        <div className="space-y-10">
          {timeline.map((node: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col md:flex-row items-start gap-4 md:gap-8 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
            >
              <div className="hidden md:flex md:w-1/2 justify-end">
                {i % 2 === 0 && renderNodeContent(node)}
              </div>
              <div className="absolute left-4 md:left-1/2 top-1.5 w-3 h-3 bg-black rounded-full shadow-md md:-translate-x-1.5 z-10" />
              <div className="pl-10 md:pl-0 md:w-1/2">
                {i % 2 !== 0 && renderNodeContent(node)}
                {i % 2 === 0 && <div className="hidden md:block" />}
              </div>
              <div className="md:hidden w-full pl-10 -mt-2">
                {renderNodeContent(node)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 富文本 ─────────────────────────────────────────────────
function RichTextContent({ data }: any) {
  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="prose prose-sm md:prose-base max-w-none text-gray-600"
        dangerouslySetInnerHTML={{ __html: data.content || '' }}
      />
    </div>
  );
}

// ─── HTML 源码（iframe 原样渲染，与后台编辑器预览结构一致） ─────
// 前台用 iframe（srcDoc）原样渲染粘贴的 HTML 源码，不套站点样式、不过滤，
// 脚本同源执行，效果与本地浏览器打开一致；高度按内容自动撑开。
function HtmlContent({ data }: any) {
  const html = data.html || '';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <HtmlBlockView html={html} />
    </motion.div>
  );
}

// ─── 轮播图（叠放拖拽） ───────────────────────────────────
function CarouselContent({ data }: any) {
  const items = data.items || [];
  const n = items.length;
  const [virtualIndex, setVirtualIndex] = useState(0);
  const current = virtualIndex % n;
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<any>(null);
  const autoPlay = data.autoPlay !== false;
  const interval = (data.interval || 3) * 1000;
  const startXRef = useRef(0);
  const trackDragRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoPlay || n <= 1) return;
    timerRef.current = setInterval(() => {
      setVirtualIndex((prev) => prev + 1);
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [autoPlay, interval, n]);

  if (n === 0) return null;

  const goTo = (v: number) => {
    setVirtualIndex(v);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleDragStart = (clientX: number) => {
    trackDragRef.current = true;
    startXRef.current = clientX;
    setIsDragging(true);
    setDragOffset(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleDragMove = (clientX: number) => {
    if (!trackDragRef.current) return;
    const width = trackRef.current?.clientWidth || 1;
    const delta = (clientX - startXRef.current) / width;
    setDragOffset(delta);
  };

  const handleDragEnd = () => {
    if (!trackDragRef.current) return;
    trackDragRef.current = false;
    setIsDragging(false);

    const threshold = 0.25;
    if (dragOffset < -threshold) {
      goTo(virtualIndex + 1);
    } else if (dragOffset > threshold) {
      goTo(virtualIndex - 1);
    }
    setDragOffset(0);
  };

  const getSlideStyle = (i: number) => {
    const nextIdx = (current + 1) % n;
    const prevIdx = (current - 1 + n) % n;

    let pos;
    if (i === current) {
      pos = dragOffset;
    } else if (i === nextIdx) {
      pos = 1 + dragOffset;
    } else if (i === prevIdx) {
      pos = -1 + dragOffset;
    } else {
      return {
        transform: 'translateX(150%) scale(0.7)',
        opacity: 0,
        zIndex: 0,
        pointerEvents: 'none' as const,
      };
    }

    if (Math.abs(pos) > 1.5) {
      return {
        transform: `translateX(${pos > 0 ? 150 : -150}%) scale(0.7)`,
        opacity: 0,
        zIndex: 0,
        pointerEvents: 'none' as const,
      };
    }

    const translateX = pos * 20;
    const scale = 1 - Math.abs(pos) * 0.18;
    const zIndex = 10 - Math.abs(Math.round(pos));
    const opacityVal = Math.abs(pos) > 1 ? 1 - (Math.abs(pos) - 1) * 2 : 1;

    return {
      transform: `translateX(${translateX}%) scale(${Math.max(0.7, scale)})`,
      zIndex,
      opacity: Math.max(0, opacityVal),
    };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-5xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl aspect-[21/9] bg-transparent select-none"
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
      >
        <div ref={trackRef} className="w-full h-full">
          {items.map((item: any, i: number) => (
            <div
              key={i}
              className="absolute inset-0 rounded-xl overflow-hidden"
              style={{
                ...getSlideStyle(i),
                transition: isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.45s ease-in-out',
              }}
            >
              {item.image && (
                <img src={getImageUrl(item.image)} alt="" className="w-full h-full object-contain pointer-events-none" />
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}