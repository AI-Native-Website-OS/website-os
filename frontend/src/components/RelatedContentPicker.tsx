'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import api from '@/lib/api';

type ContentItem = { id: number; title: string; slug: string; summary: string; coverImage: string; type: string };

interface Props {
  value: string;
  onChange: (ids: string) => void;
  types?: string[];
  label: string;
}

const TYPE_LABELS: Record<string, string> = {
  product: '产品', solution: '方案', case: '案例', resource: '资源',
};

export default function RelatedContentPicker({ value, onChange, types, label }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pages: number; records: ContentItem[] }>({ total: 0, pages: 0, records: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preloaded, setPreloaded] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const allTypes = useMemo(() => types || ['product', 'solution', 'case', 'resource'], [types]);

  const ids = useMemo(() => value ? value.split(',').map(Number).filter(Boolean) : [], [value]);

  useEffect(() => {
    if (!open || !tab) return;
    setKeyword('');
    setPage(1);
    setSelected(new Set(ids));
  }, [open, tab, ids]);

  const loadTab = useCallback(async (t: string, kw: string, p: number) => {
    if (!t) return;
    setTabLoading(true);
    try {
      const res = await api.get('/admin/related-content/list', { params: { type: t, page: p, size: 10, keyword: kw || undefined } });
      setData(res.data);
    } catch { setData({ total: 0, pages: 0, records: [] }); }
    finally { setTabLoading(false); }
  }, []);

  useEffect(() => {
    loadTab(tab, keyword, page);
  }, [tab, keyword, page, loadTab]);

  const search = () => {
    setPage(1);
    loadTab(tab, keyword, 1);
  };

  useEffect(() => {
    if (!open) return;
    setTab(allTypes[0]);
  }, [open, allTypes]);

  useEffect(() => {
    if (ids.length === 0) { setPreloaded([]); return; }
    const load = async () => {
      setLoading(true);
      const items: ContentItem[] = [];
      for (const t of allTypes) {
        try {
          const res = await api.get('/admin/related-content/batch', { params: { type: t, ids: ids.join(',') } });
          if (res.data?.length) items.push(...res.data);
        } catch {}
      }
      setPreloaded(items);
      setLoading(false);
    };
    load();
  }, [value, allTypes, ids]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const confirm = () => {
    onChange(Array.from(selected).join(','));
    setOpen(false);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[38px]">
        {loading && <span className="text-xs text-gray-400">加载中...</span>}
        {preloaded.map(item => (
          <span key={`${item.type}-${item.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
            <span className="text-[10px] opacity-60">{TYPE_LABELS[item.type]}</span>
            {item.title}
          </span>
        ))}
        {!loading && ids.length === 0 && <span className="text-xs text-gray-400">未选择</span>}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
        选择{label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-[680px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold">选择{label}</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex gap-1 px-5 pt-3 border-b border-gray-200">
              {allTypes.map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-t cursor-pointer ${tab === t ? 'bg-blue-50 text-blue-700 font-medium border border-b-white border-gray-200 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}>
                  {TYPE_LABELS[t] || t}
                </button>
              ))}
            </div>

            <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="搜索..." className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-xs" />
              </div>
              <button onClick={search} className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">搜索</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {tabLoading && <div className="py-8 text-center text-xs text-gray-400">加载中...</div>}
              {!tabLoading && data.records.length === 0 && <div className="py-8 text-center text-xs text-gray-400">暂无数据</div>}
              {!tabLoading && data.records.map(item => (
                <label key={item.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="rounded border-gray-300" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    {item.summary && <div className="text-xs text-gray-400 truncate">{item.summary}</div>}
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{TYPE_LABELS[item.type]}</span>
                </label>
              ))}
            </div>

            {data.pages > 1 && (
              <div className="flex justify-center gap-1 px-5 py-2 border-t border-gray-100">
                {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)} className={`px-2 py-0.5 text-xs rounded cursor-pointer ${page === i + 1 ? 'bg-black text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>{i + 1}</button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <span className="text-xs text-gray-500">已选 {selected.size} 项</span>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="px-4 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">取消</button>
                <button onClick={confirm} className="px-4 py-1.5 text-xs bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer">确定</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
