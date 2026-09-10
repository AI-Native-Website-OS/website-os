'use client';

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '@/lib/adminApi';
import { SeoConfig, SyncProgress } from '@/types';
import { SITE_URL } from '@/lib/seo';
import { useI18n } from '@/i18n/I18nProvider';
import { Plus, Pencil, Trash2, X, Save, RefreshCw, Check, AlertCircle, Search, ExternalLink, FileText, LayoutGrid } from 'lucide-react';

interface ApiResponse<T> { code?: number; data?: T | null; message?: string; }

const EMPTY_FORM: Partial<SeoConfig> = {
  pageId: undefined as any,
  title: '',
  description: '',
  keywords: '',
  canonicalUrl: '',
};

interface PageOption {
  type: string;
  label: string;
  pageId: number | null;
  title: string;
  url: string;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}{hint && <span className="text-gray-400 font-normal ml-1">（{hint}）</span>}</span>
      {children}
    </label>
  );
}

export interface GeoFileEditorHandle {
  save: () => Promise<void>;
}

interface GeoFileEditorProps {
  title: string;
  description: string;
  getFile: () => Promise<ApiResponse<{ content: string; path: string }>>;
  saveFile: (content: string) => Promise<ApiResponse<void>>;
}

const GeoFileEditor = forwardRef<GeoFileEditorHandle, GeoFileEditorProps>(
  function GeoFileEditor({ title, description, getFile, saveFile }, ref) {
    const { t } = useI18n();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
      setLoading(true);
      try {
        const res = await getFile();
        setContent(res?.data?.content ?? '');
        setDirty(false);
      } catch (e: any) {
        setMsg({ text: e?.message || t('common.loadFail'), type: 'error' });
      } finally {
        setLoading(false);
      }
    }, [getFile, t]);

    useEffect(() => { load(); }, [load]);

    const handleSave = useCallback(async () => {
      try {
        await saveFile(content);
        setMsg({ text: t('admin.ui.seo.geoSaveSuccess'), type: 'success' });
        setDirty(false);
      } catch (e: any) {
        setMsg({ text: e?.message || t('common.saveFail'), type: 'error' });
      }
    }, [content, saveFile, t]);

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

    const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400';

    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>

        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
          rows={10}
          className={`${inputCls} font-mono text-xs leading-relaxed resize-y ${dirty ? 'border-amber-300 bg-amber-50/40' : ''}`}
        />

        {msg && (
          <span className={`text-xs ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
        )}
      </div>
    );
  }
);

function SyncProgressPanel({ progress, t }: { progress: SyncProgress; t: (key: string) => string }) {
  const running = progress.status !== 'completed' && progress.status !== 'error';
  const statusLabel =
    progress.status === 'error'
      ? t('admin.ui.seo.syncError')
      : progress.status === 'completed'
        ? t('admin.ui.seo.syncDone')
        : t('admin.ui.seo.syncingText');
  const barColor = progress.status === 'error' ? 'bg-red-500' : progress.percent === 100 ? 'bg-green-500' : 'bg-black';
  return (
    <div className="w-full bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {running && (
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-xs font-medium text-gray-700">{statusLabel}</span>
        </div>
        <span className="text-xs text-gray-500">
          {t('admin.ui.seo.syncSuccessCount').replace('{success}', String(progress.success))}{progress.fail ? t('admin.ui.seo.syncFailCount').replace('{fail}', String(progress.fail)) : ''}
          {progress.status === 'running' && progress.total > 0 && t('admin.ui.seo.syncProgress').replace('{current}', String(progress.current)).replace('{total}', String(progress.total))}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {progress.currentItem && (
        <p className="text-[10px] text-gray-400 mt-1.5 truncate">{t('admin.ui.seo.currentItem').replace('{item}', progress.currentItem)}</p>
      )}
      {progress.status === 'error' && progress.errorMessage && (
        <p className="text-[10px] text-red-500 mt-1">{progress.errorMessage}</p>
      )}
    </div>
  );
}

export default function AdminSeo() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'config' | 'geo'>('config');
  const [configs, setConfigs] = useState<SeoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SeoConfig>>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pageOptions, setPageOptions] = useState<PageOption[]>([]);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const geoFileRefs = useRef<Record<string, GeoFileEditorHandle | null>>({});
  const [geoSaving, setGeoSaving] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.seo.list();
      setConfigs(res.data || []);
    } catch (err) { console.error(err); showToast(t('admin.ui.seo.loadFail'), 'error'); }
    finally { setLoading(false); }
  }, [showToast, t]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const loadPageOptions = useCallback(async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await adminApi.seo.pages(origin);
      setPageOptions(res.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadPageOptions(); }, [loadPageOptions]);

  const handleSaveAllGeoFiles = async () => {
    setGeoSaving(true);
    try {
      await Promise.all(Object.values(geoFileRefs.current).map((ref) => (ref ? ref.save() : Promise.resolve())));
    } finally {
      setGeoSaving(false);
    }
  };

  const openEdit = async (item: SeoConfig) => {
    setEditingId(item.id);
    setForm({
      pageId: item.pageId ?? undefined as any,
      title: item.title || '',
      description: item.description || '',
      keywords: item.keywords || '',
      canonicalUrl: item.canonicalUrl || '',
    });
    setFaqs([]);
    setShowForm(true);
    try {
      const res = await adminApi.seo.detail(item.id);
      const detail = res?.data;
      if (detail) {
        setFaqs((detail.faqs || []).map((f) => ({ question: f.question || '', answer: f.answer || '' })));
      }
    } catch (err) { console.error(err); }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFaqs([]);
    setShowForm(true);
  };

  const addFaq = () => setFaqs((prev) => [...prev, { question: '', answer: '' }]);
  const removeFaq = (i: number) => setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, field: 'question' | 'answer', value: string) =>
    setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));

  const handlePickPage = (url: string) => {
    const opt = pageOptions.find((o) => o.url === url);
    if (!opt) return;
    setForm({
      ...form,
      pageId: opt.pageId ?? undefined as any,
      title: opt.title,
      canonicalUrl: opt.url,
    });
  };

  const handleSave = async () => {
    const url = form.canonicalUrl?.trim() || '';
    if (!form.title?.trim()) {
      showToast(t('admin.ui.seo.titleRequired'), 'error');
      return;
    }
    if (!url) {
      showToast(t('admin.ui.seo.canonicalRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        pageId: form.pageId || null,
        title: form.title,
        description: form.description || '',
        keywords: form.keywords || '',
        canonicalUrl: url,
        // 以下字段已不在表单编辑，保存时固定为默认值：
        // enabled=1 始终参与 GEO 生成；geoOptional=0 始终归入主分组；
        // robots=index,follow；geoSummary/OG 为空 → 生成时回退使用 description / HTML 内容。
        geoSummary: '',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
        robots: 'index,follow',
        enabled: 1,
        geoOptional: 0,
      };
      const faqPayload = faqs
        .filter((f) => f.question?.trim())
        .map((f) => ({ question: f.question.trim(), answer: f.answer || '' }));
      if (editingId != null) {
        await adminApi.seo.update(editingId, payload);
        await adminApi.seo.updateGeo(editingId, { faqs: faqPayload, geoSummary: payload.geoSummary, enabled: payload.enabled, geoOptional: payload.geoOptional, ogTitle: payload.ogTitle, ogDescription: payload.ogDescription, ogImage: payload.ogImage, robots: payload.robots });
      } else {
        const created: any = await adminApi.seo.create(payload);
        const id = created?.data?.id;
        if (id != null) {
          await adminApi.seo.updateGeo(id, { faqs: faqPayload, geoSummary: payload.geoSummary, enabled: payload.enabled, geoOptional: payload.geoOptional, ogTitle: payload.ogTitle, ogDescription: payload.ogDescription, ogImage: payload.ogImage, robots: payload.robots });
        }
      }
      showToast(editingId != null ? t('admin.ui.sections.updateSuccess') : t('admin.ui.sections.createSuccess'));
      setShowForm(false);
      loadConfigs();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || t('common.saveFail'), 'error');
    }
    finally { setSaving(false); }
  };

  const handleSyncAll = async () => {
    if (!confirm(t('admin.ui.seo.syncConfirm'))) return;
    setSyncing(true);
    setSyncProgress(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res: any = await adminApi.seo.sync(origin);
      const taskId = res?.data?.taskId;
      if (!taskId) {
        showToast(t('admin.ui.seo.syncStartFail'), 'error');
        setSyncing(false);
        return;
      }
      setSyncProgress({ taskId, type: 'seo_geo', status: 'running', total: 0, current: 0, success: 0, fail: 0, currentItem: '', errorMessage: '', percent: 0 });
      syncTimerRef.current = setInterval(async () => {
        try {
          const pr = await adminApi.seo.getSyncProgress(taskId);
          const p = pr?.data;
          if (!p) return;
          setSyncProgress({ ...p });
          if (p.status === 'completed' || p.status === 'error') {
            if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
            setSyncing(false);
            loadConfigs();
            loadPageOptions();
            showToast(
              p.status === 'completed'
                ? t('admin.ui.seo.syncDoneMsg').replace('{success}', String(p.success)).replace('{fail}', String(p.fail))
                : t('admin.ui.seo.syncFailMsg').replace('{msg}', p.errorMessage || t('common.unknown')),
              p.status === 'completed' ? 'success' : 'error'
            );
          }
        } catch {
          if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
          setSyncing(false);
        }
      }, 1000);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || t('admin.ui.seo.syncStartFail2'), 'error');
      setSyncing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
    };
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.ui.seo.deleteConfirm'))) return;
    try {
      await adminApi.seo.delete(id);
      showToast(t('common.deleteSuccess'));
      loadConfigs();
    } catch (err) { console.error(err); showToast(t('admin.ui.sections.deleteFail'), 'error'); }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400';

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.seo')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.ui.seo.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors ${tab === 'config' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <LayoutGrid className="w-4 h-4" />{t('admin.ui.seo.tabConfig')}
        </button>
        <button
          onClick={() => setTab('geo')}
          className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors ${tab === 'geo' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <FileText className="w-4 h-4" />{t('admin.ui.seo.tabGeo')}
        </button>
      </div>

      {tab === 'config' && (
        <>
          <div className="flex justify-end mb-4 gap-2">
            <button onClick={handleSyncAll} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('common.syncing') : t('common.syncAll')}
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">
              <Plus className="w-4 h-4" />{t('admin.ui.seo.newConfig')}
            </button>
          </div>

          {syncProgress && <SyncProgressPanel progress={syncProgress} t={t} />}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.seo.colPage')}</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.seo.colCanonical')}</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.seo.colDesc')}</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.seo.colKeywords')}</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium max-w-[180px] truncate">{item.title || '-'}</td>
                      <td className="py-3 px-4">
                        <a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-xs max-w-[220px] truncate" title={item.canonicalUrl}>
                          {item.canonicalUrl || '-'}<ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate">{item.description || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 max-w-[160px] truncate">{item.keywords || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors" title={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('common.delete')}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {configs.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-400">{t('admin.ui.seo.noConfigs')}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'geo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {t('admin.ui.seo.geoDesc')}
            </p>
            <button onClick={handleSaveAllGeoFiles} disabled={geoSaving} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
              {geoSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {geoSaving ? t('common.saving') : t('common.saveAll')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GeoFileEditor
              ref={(el) => { geoFileRefs.current['llms'] = el; }}
              title="llms.txt"
              description={t('admin.ui.seo.geoDescLlms')}
              getFile={adminApi.seoFiles.getLlmsTxt}
              saveFile={adminApi.seoFiles.saveLlmsTxt}
            />
            <GeoFileEditor
              ref={(el) => { geoFileRefs.current['llmsFull'] = el; }}
              title="llms-full.txt"
              description={t('admin.ui.seo.geoDescLlmsFull')}
              getFile={adminApi.seoFiles.getLlmsFullTxt}
              saveFile={adminApi.seoFiles.saveLlmsFullTxt}
            />
            <GeoFileEditor
              ref={(el) => { geoFileRefs.current['robots'] = el; }}
              title="robots.txt"
              description={t('admin.ui.seo.geoDescRobots')}
              getFile={adminApi.seoFiles.getRobotsTxt}
              saveFile={adminApi.seoFiles.saveRobotsTxt}
            />
            <GeoFileEditor
              ref={(el) => { geoFileRefs.current['sitemap'] = el; }}
              title="sitemap.xml"
              description={t('admin.ui.seo.geoDescSitemap')}
              getFile={adminApi.seoFiles.getSitemapXml}
              saveFile={adminApi.seoFiles.saveSitemapXml}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <h3 className="text-lg font-semibold text-black">{editingId != null ? t('admin.ui.seo.editTitle') : t('admin.ui.seo.newTitle')}</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <Field label={t('admin.ui.seo.fieldSelectPage')}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={form.canonicalUrl || ''}
                      onChange={e => handlePickPage(e.target.value)}
                      className={`${inputCls} pl-9 bg-white`}
                    >
                      <option value="">{t('admin.ui.seo.selectPagePlaceholder')}</option>
                      {pageOptions.map((o, i) => (
                        <option key={`${o.type}-${o.pageId ?? o.url}`} value={o.url}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </Field>

                <Field label={t('admin.ui.seo.fieldTitle')} required>
                  <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('admin.ui.seo.titlePlaceholder')} className={inputCls} />
                </Field>

                <Field label={t('admin.ui.seo.fieldCanonical')} required>
                  <input value={form.canonicalUrl || ''} onChange={e => setForm({ ...form, canonicalUrl: e.target.value })} placeholder={`${SITE_URL}/list/category?moduleKey=products`} className={inputCls} />
                </Field>

                <Field label={t('admin.ui.seo.fieldDesc')} hint={t('admin.ui.seo.descHint')}>
                  <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} />
                </Field>

                <Field label={t('admin.ui.seo.fieldKeywords')} hint={t('admin.ui.seo.keywordsHint')}>
                  <textarea value={form.keywords || ''} onChange={e => setForm({ ...form, keywords: e.target.value })} rows={2} className={inputCls} />
                </Field>

                <Field label={t('admin.ui.seo.fieldFaq')}>
                  <div className="space-y-2">
                    {faqs.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 border border-gray-200 rounded-lg p-3">
                        <div className="flex-1 space-y-2 min-w-0">
                          <input value={f.question} onChange={e => updateFaq(i, 'question', e.target.value)} placeholder={t('admin.ui.seo.questionPlaceholder')} className={inputCls} />
                          <textarea value={f.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} rows={2} placeholder={t('admin.ui.seo.answerPlaceholder')} className={inputCls} />
                        </div>
                        <button onClick={() => removeFaq(i)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('common.delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={addFaq} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                      <Plus className="w-4 h-4" />{t('admin.ui.seo.addRow')}
                    </button>
                  </div>
                </Field>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}