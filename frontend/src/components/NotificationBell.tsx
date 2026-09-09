'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, X, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import type { Lead } from '@/types';

const SOURCE_LABELS: Record<string, string> = {
  'ai_chat': 'AI顾问咨询',
  'page_click': '页面浏览',
  'whitepaper': '下载白皮书',
  'registration': '用户注册',
  'form': '联系表单',
  'cta-form': 'CTA表单',
  'product-cta': '产品预约演示',
  'solution-cta': '获取解决方案',
  'case-cta': '咨询同类案例',
  'whitepaper-cta': '白皮书订阅',
  'demo-booking': '预约产品演示',
  'solution': '获取解决方案',
  'contact': '提交咨询表单',
};

export default function NotificationBell() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchLatest = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/leads', { params: { page: 1, size: 10, status: 'new' } });
      setLeads(res.data?.records || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchLatest();
    const timer = setInterval(fetchLatest, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {leads.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {leads.length > 9 ? '9+' : leads.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">待跟进线索</span>
            <button onClick={fetchLatest} className="p-1 text-gray-400 hover:text-black transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {leads.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">暂无提交记录</div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600 mb-1">
                        {SOURCE_LABELS[lead.source] || lead.source || '未知来源'}
                      </span>
                      <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-500 truncate">{lead.company || lead.phone}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {formatTime(lead.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/leads" className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs text-gray-500 hover:text-black border-t border-gray-100 transition-colors" onClick={() => setOpen(false)}>
            查看全部记录
          </Link>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
