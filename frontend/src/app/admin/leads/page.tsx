'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '@/lib/adminApi';
import config from '@/config';
import { Lead, PageResult, LeadFilterOptions } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Search, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2, Calendar
} from 'lucide-react';

const STATUS_CYCLE = ['new', 'contacted', 'qualified', 'quoted', 'closed', 'invalid'];

const STATUS_MAP: Record<string, { labelKey: string; color: string }> = {
  new: { labelKey: 'admin.ui.leads.status.new', color: 'bg-blue-100 text-blue-700' },
  contacted: { labelKey: 'admin.ui.leads.status.contacted', color: 'bg-yellow-100 text-yellow-700' },
  qualified: { labelKey: 'admin.ui.leads.status.qualified', color: 'bg-green-100 text-green-700' },
  quoted: { labelKey: 'admin.ui.leads.status.quoted', color: 'bg-purple-100 text-purple-700' },
  closed: { labelKey: 'admin.ui.leads.status.closed', color: 'bg-emerald-100 text-emerald-700' },
  invalid: { labelKey: 'admin.ui.leads.status.invalid', color: 'bg-gray-100 text-gray-500' },
};

const SORTABLE_COLS = [
  { key: 'name', labelKey: 'admin.ui.leads.fieldName' },
  { key: 'company', labelKey: 'admin.ui.leads.fieldCompany' },
  { key: 'phone', labelKey: 'admin.ui.leads.fieldPhone' },
  { key: 'status', labelKey: 'admin.ui.leads.colStatus' },
  { key: 'createdAt', labelKey: 'admin.ui.leads.fieldCreatedAt' },
];

export default function AdminLeads() {
  const [data, setData] = useState<PageResult<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const statusLabel = (k?: string) => (k && STATUS_MAP[k] ? t(STATUS_MAP[k].labelKey) : (k || ''));
  const statusColor = (k?: string) => (k && STATUS_MAP[k] ? STATUS_MAP[k].color : 'bg-gray-100 text-gray-500');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [sourcePageFilter, setSourcePageFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState<LeadFilterOptions | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.leads.list({
        page, size: 10,
        keyword: debouncedKeyword || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        name: nameFilter || undefined,
        company: companyFilter || undefined,
        phone: phoneFilter || undefined,
        sourcePage: sourcePageFilter || undefined,
        ipAddress: ipFilter || undefined,
        location: locationFilter || undefined,
        sortBy: sortBy || undefined,
        sortOrder,
      });
      setData(res.data);
      setSelectedIds(new Set());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, sortBy, sortOrder, debouncedKeyword, statusFilter, startDate, endDate, nameFilter, companyFilter, phoneFilter, sourcePageFilter, ipFilter, locationFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    adminApi.leads.filterOptions()
      .then(res => setFilterOptions(res.data || null))
      .catch(() => setFilterOptions(null));
  }, []);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      if (sortOrder === 'asc') { setSortOrder('desc'); }
      else { setSortBy(''); setSortOrder('asc'); }
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try { await adminApi.leads.updateStatus(id, status); loadData(); } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.ui.leads.deleteConfirm'))) return;
    try { await adminApi.leads.delete(id); loadData(); } catch (err) { console.error(err); }
  };

  const handleBatchStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('admin.ui.leads.batchStatusConfirm').replace('{n}', String(selectedIds.size)).replace('{label}', statusLabel(status)))) return;
    try {
      await adminApi.leads.batchUpdateStatus(Array.from(selectedIds), status);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('admin.ui.leads.batchDeleteConfirm').replace('{n}', String(selectedIds.size)))) return;
    try {
      await adminApi.leads.batchDelete(Array.from(selectedIds));
      loadData();
    } catch (err) { console.error(err); }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.records) return;
    if (selectedIds.size === data.records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.records.map(r => r.id)));
    }
  };

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert(t('admin.ui.leads.exportAlert'));
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('ids', Array.from(selectedIds).join(','));
      const res = await fetch(`${config.api.baseUrl}/admin/leads/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(t('admin.ui.leads.exportFail'));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `线索清单_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('admin.ui.leads.exportFail'));
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-200" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-black" /> : <ArrowDown className="w-3.5 h-3.5 text-black" />;
  };

  const ViewField = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="p-3 bg-gray-50 rounded-xl">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <span className="font-medium text-gray-900 text-sm break-all">{value ?? '-'}</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.leads')}</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-gray-500">{t('admin.ui.leads.selectedCount').replace('{n}', String(selectedIds.size))}</span>
              <select onChange={e => handleBatchStatus(e.target.value)} value="" className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="" disabled>{t('admin.ui.leads.batchStatus')}</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{t(v.labelKey)}</option>)}
              </select>
              <button onClick={handleBatchDelete} className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />{t('admin.ui.leads.batchDelete')}</button>
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><Download className="w-4 h-4" />{t('admin.ui.leads.export')}</button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} placeholder={t('admin.ui.leads.searchPlaceholder')} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allStatus')}</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{t(v.labelKey)}</option>)}
        </select>
        <select value={nameFilter} onChange={e => { setNameFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allName')}</option>
          {(filterOptions?.names || []).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={companyFilter} onChange={e => { setCompanyFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allCompany')}</option>
          {(filterOptions?.companies || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={phoneFilter} onChange={e => { setPhoneFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allPhone')}</option>
          {(filterOptions?.phones || []).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sourcePageFilter} onChange={e => { setSourcePageFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allSourcePage')}</option>
          {(filterOptions?.sourcePages || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={ipFilter} onChange={e => { setIpFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allIp')}</option>
          {(filterOptions?.ips || []).map(ip => <option key={ip} value={ip}>{ip}</option>)}
        </select>
        <select value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('admin.ui.leads.allLocation')}</option>
          {(filterOptions?.locations || []).map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-500 whitespace-nowrap">{t('admin.ui.leads.fieldCreatedAt')}</span>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className="bg-transparent border-0 outline-none text-sm px-1 py-0.5" />
          <span className="text-gray-400">~</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className="bg-transparent border-0 outline-none text-sm px-1 py-0.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-3 w-10">
                <input type="checkbox" checked={data?.records ? selectedIds.size === data.records.length && data.records.length > 0 : false} onChange={toggleSelectAll} className="rounded border-gray-300" />
              </th>
              {SORTABLE_COLS.map(col => (
                <th key={col.key} className="text-left py-3 px-3 font-medium text-gray-500 cursor-pointer select-none hover:text-black transition-colors" onClick={() => handleSort(col.key)}>
                  <div className="flex items-center gap-1">
                    {t(col.labelKey)}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
              <th className="text-left py-3 px-3 font-medium text-gray-500">{t('admin.ui.leads.sourcePage')}</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">{t('admin.ui.leads.fieldIp')}</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">{t('admin.ui.leads.fieldCity')}</th>
              <th className="text-center py-3 px-3 font-medium text-gray-500">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.records?.map((item) => (
              <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${selectedIds.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                <td className="py-3 px-3">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded border-gray-300" />
                </td>
                <td className="py-3 px-3 font-medium">{item.name || t('common.guest')}</td>
                <td className="py-3 px-3 text-gray-500 max-w-[120px] truncate">{item.company}</td>
                <td className="py-3 px-3 text-gray-500">{item.phone}</td>
                <td className="py-3 px-3">
                  <button onClick={() => {
                    const idx = STATUS_CYCLE.indexOf(item.status);
                    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
                    handleStatusChange(item.id, next);
                  }} className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${statusColor(item.status)}`}>
                    {statusLabel(item.status)}
                  </button>
                </td>
                <td className="py-3 px-3 text-gray-500 text-xs">{item.createdAt?.slice(0, 10)}</td>
                <td className="py-3 px-3 text-gray-500 text-xs max-w-[160px] truncate" title={item.sourcePage}>{item.sourcePage || '-'}</td>
                <td className="py-3 px-3 text-gray-500 text-xs font-mono">{item.ipAddress || '-'}</td>
                <td className="py-3 px-3 text-gray-500 text-xs">{[item.country, item.province, item.city].filter(Boolean).join(' · ') || '-'}</td>
                <td className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openDetail(item)} className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors" title={t('admin.ui.leads.viewDetail')}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('common.delete')}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.records || data.records.length === 0) && <tr><td colSpan={11} className="py-12 text-center text-gray-400">{t('common.empty')}</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-black text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>{i + 1}</button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedLead && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLead(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-black">{t('admin.ui.leads.detailTitle')}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(selectedLead.status)}`}>
                    {statusLabel(selectedLead.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedLead(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-3 gap-3">
                  <ViewField label={t('admin.ui.leads.fieldName')} value={selectedLead.name} />
                  <ViewField label={t('admin.ui.leads.fieldCompany')} value={selectedLead.company} />
                  <ViewField label={t('admin.ui.leads.fieldPhone')} value={selectedLead.phone} />
                  <ViewField label={t('admin.ui.leads.colStatus')} value={statusLabel(selectedLead.status)} />
                  <ViewField label={t('admin.ui.leads.fieldCreatedAt')} value={selectedLead.createdAt?.slice(0, 16)} />
                  <ViewField label={t('admin.ui.leads.fieldSourcePage')} value={selectedLead.sourcePage} />
                  <ViewField label={t('admin.ui.leads.fieldIp')} value={selectedLead.ipAddress} />
                  <ViewField label={t('admin.ui.leads.fieldCity')} value={[selectedLead.country, selectedLead.province, selectedLead.city].filter(Boolean).join(' · ')} />
                  <div className="col-span-3">
                    <ViewField label={t('admin.ui.leads.fieldRequirement')} value={selectedLead.requirement} />
                  </div>
                  <div className="col-span-3">
                    <ViewField label={t('admin.ui.leads.fieldFollowUpNote')} value={selectedLead.followUpNote} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}