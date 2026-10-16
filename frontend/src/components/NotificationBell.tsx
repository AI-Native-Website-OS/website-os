'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, X, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import type { Lead } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { t as translate } from '@/i18n/translate';

const SOURCE_LABEL_KEYS: Record<string, string> = {
  'ai_chat': 'adminComp.leads.source.ai_chat',
  'page_click': 'adminComp.leads.source.page_click',
  'whitepaper': 'adminComp.leads.source.whitepaper',
  'registration': 'adminComp.leads.source.registration',
  'form': 'adminComp.leads.source.form',
  'cta-form': 'adminComp.leads.source.cta-form',
  'product-cta': 'adminComp.leads.source.product-cta',
  'solution-cta': 'adminComp.leads.source.solution-cta',
  'case-cta': 'adminComp.leads.source.case-cta',
  'whitepaper-cta': 'adminComp.leads.source.whitepaper-cta',
  'demo-booking': 'adminComp.leads.source.demo-booking',
  'solution': 'adminComp.leads.source.solution',
  'contact': 'adminComp.leads.source.contact',
};

export default function NotificationBell() {
  const { t } = useI18n();
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
            <span className="text-sm font-semibold text-gray-900">{t('adminComp.leads.pending')}</span>
            <button onClick={fetchLatest} className="p-1 text-gray-400 hover:text-black transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {leads.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">{t('adminComp.leads.noRecords')}</div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600 mb-1">
                        {SOURCE_LABEL_KEYS[lead.source] ? t(SOURCE_LABEL_KEYS[lead.source]) : (lead.source || t('adminComp.unknownSource'))}
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
            {t('adminComp.leads.viewAll')}
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
  if (diff < 60000) return translate('adminComp.leads.justNow');
  if (diff < 3600000) return translate('adminComp.leads.minutesAgo', { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return translate('adminComp.leads.hoursAgo', { n: Math.floor(diff / 3600000) });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
