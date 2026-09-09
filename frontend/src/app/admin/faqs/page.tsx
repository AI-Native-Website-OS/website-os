'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Faq, PageResult } from '@/types';
import { Plus, Trash2, Search, Check, X, Pencil, Loader2, Globe, RefreshCw } from 'lucide-react';
import { useSyncProgress } from '@/hooks/useSyncProgress';
import { useI18n } from '@/i18n/I18nProvider';

import { useConfirm } from '@/components/ConfirmDialog';

export default function AdminFaqs() {
  const [data, setData] = useState<PageResult<Faq> | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [newRow, setNewRow] = useState<{ question: string; answer: string; saving: boolean } | null>(null);
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ question: string; answer: string }>({ question: '', answer: '' });
  const { progress, syncing, startSync, stopSync } = useSyncProgress();
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.faqs.list({ page, size: 10, keyword: keyword || undefined });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm(t('admin.ui.faqs.deleteConfirm')))) return;
    try { await adminApi.faqs.delete(id); loadData(); } catch (err) { console.error(err); }
  };

  const handleNewRowSave = async () => {
    if (!newRow || !newRow.question.trim() || !newRow.answer.trim()) return;
    setSaving(true);
    setNewRow({ ...newRow, saving: true });
    try {
      await adminApi.faqs.create({ question: newRow.question, answer: newRow.answer, status: 1 });
      setNewRow(null);
      loadData();
    } catch (err) { console.error(err); setNewRow({ ...newRow, saving: false }); }
    finally { setSaving(false); }
  };

  const handleEditSave = async (id: number) => {
    if (!editForm.question.trim() || !editForm.answer.trim()) return;
    setSaving(true);
    try {
      await adminApi.faqs.update(id, { question: editForm.question, answer: editForm.answer });
      setEditRowId(null);
      loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  useEffect(() => () => stopSync(), [stopSync]);

  const handleSync = () => {
    startSync('faq');
  };

  const toggleStatus = async (item: Faq) => {
    const newStatus = item.status === 1 ? 0 : 1;
    setData(prev => prev ? { ...prev, records: prev.records.map(r => r.id === item.id ? { ...r, status: newStatus } : r) } : prev);
    try { await adminApi.faqs.update(item.id, { status: newStatus }); }
    catch (err) { setData(prev => prev ? { ...prev, records: prev.records.map(r => r.id === item.id ? { ...r, status: item.status } : r) } : prev); console.error(err); }
  };

  return (
    <div>
      {ConfirmDialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.faqs')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            title={t('admin.ui.sections.syncTitle')}
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            {syncing ? t('common.syncing') : t('common.syncAll')}
          </button>
          <button onClick={() => { setNewRow({ question: '', answer: '', saving: false }); }} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">
            <Plus className="w-4 h-4" /> {t('admin.ui.faqs.addFaq')}
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadData()} placeholder={t('admin.ui.faqs.searchPlaceholder')} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <button onClick={loadData} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.search')}</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.faqs.colQuestion')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.faqs.colAnswer')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-20">{t('admin.ui.sections.colStatus')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-24">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {newRow && (
              <tr className="border-b border-blue-200 bg-blue-50">
                <td className="py-2 px-4"><input value={newRow.question} onChange={(e) => setNewRow({ ...newRow, question: e.target.value })} placeholder={t('admin.ui.faqs.questionPlaceholder')} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /><span className="text-red-400 text-xs ml-1">*</span></td>
                <td className="py-2 px-4"><textarea value={newRow.answer} onChange={(e) => setNewRow({ ...newRow, answer: e.target.value })} rows={2} placeholder={t('admin.ui.faqs.answerPlaceholder')} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /><span className="text-red-400 text-xs ml-1">*</span></td>
                <td className="py-2 px-4 text-center text-xs text-gray-400">{t('admin.ui.faqs.statusNew')}</td>
                <td className="py-2 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={handleNewRowSave} disabled={saving || !newRow.question.trim() || !newRow.answer.trim()} className="p-1 text-green-600 hover:text-green-800 disabled:text-gray-300">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
                    <button onClick={() => setNewRow(null)} className="p-1 text-gray-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            )}
            {data?.records?.map((item) => (
              editRowId === item.id ? (
                <tr key={item.id} className="border-b border-yellow-200 bg-yellow-50">
                  <td className="py-2 px-4"><input value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /><span className="text-red-400 text-xs ml-1">*</span></td>
                  <td className="py-2 px-4"><textarea value={editForm.answer} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })} rows={2} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /><span className="text-red-400 text-xs ml-1">*</span></td>
                  <td className="py-2 px-4 text-center text-xs text-gray-400">{t('admin.ui.faqs.statusEditing')}</td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEditSave(item.id)} disabled={saving || !editForm.question.trim() || !editForm.answer.trim()} className="p-1 text-green-600 hover:text-green-800 disabled:text-gray-300">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
                      <button onClick={() => setEditRowId(null)} className="p-1 text-gray-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium truncate max-w-[300px]">{item.question}</td>
                  <td className="py-3 px-4 text-gray-600 truncate max-w-[400px]">{item.answer}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleStatus(item)} className={`px-2 py-0.5 rounded text-xs cursor-pointer ${item.status === 1 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {item.status === 1 ? t('common.enable') : t('common.disable')}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditRowId(item.id); setEditForm({ question: item.question, answer: item.answer }); }} className="p-1 text-gray-500 hover:text-black"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            ))}
            {(!data?.records || data.records.length === 0) && !newRow && <tr><td colSpan={4} className="py-8 text-center text-gray-400">{t('common.empty')}</td></tr>}
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
    </div>
  );
}

