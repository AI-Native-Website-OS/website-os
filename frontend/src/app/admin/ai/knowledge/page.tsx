'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { aiService } from '@/lib/aiService';
import { adminApi } from '@/lib/adminApi';
import {
  Plus, Trash2, Upload, Search as SearchIcon, FileText,
  BookOpen, RotateCcw, Check, AlertCircle, X, Database,
  RefreshCw, Sliders, ChevronLeft, Download, Info, Globe,
  Settings, Scissors, Filter, Cpu, Layers, GripHorizontal
} from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useI18n } from '@/i18n/I18nProvider';
import type {
  KnowledgeBaseOut, KnowledgeDocumentOut,
  KnowledgeChunkOut, RagConfigOut,
} from '@/types';

// ── Utils ───────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const STATUS_KEYS: Record<number, { labelKey: string; color: string }> = {
  0: { labelKey: 'admin.ui.knowledge.docStatus0', color: 'text-yellow-600 bg-yellow-50' },
  1: { labelKey: 'admin.ui.knowledge.docStatus1', color: 'text-green-600 bg-green-50' },
  3: { labelKey: 'admin.ui.knowledge.docStatus3', color: 'text-red-600 bg-red-50' },
};

// ═══════════════════════════════════════════════════════════════════
//  Knowledge Base Management Page
// ═══════════════════════════════════════════════════════════════════

export default function AdminKnowledgePage() {
  const { t } = useI18n();
  // View state: 'list' | 'detail'
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseOut | null>(null);

  // KB list
  const [kbs, setKbs] = useState<KnowledgeBaseOut[]>([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Create KB
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Document list
  const [docs, setDocs] = useState<KnowledgeDocumentOut[]>([]);
  const [docLoading, setDocLoading] = useState(false);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeChunkOut[]>([]);
  const [searching, setSearching] = useState(false);

  // KB config editing
  const [editConfig, setEditConfig] = useState(false);
  const [kbConfig, setKbConfig] = useState<Partial<KnowledgeBaseOut>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Model config (for embedding/reranker display)
  const [embeddingProvider, setEmbeddingProvider] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [rerankerProvider, setRerankerProvider] = useState('');
  const [rerankerModelGlobal, setRerankerModelGlobal] = useState('');

  // RAG config
  const [ragConfig, setRagConfig] = useState<RagConfigOut | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  // Global sync
  const [syncing, setSyncing] = useState(false);

  // Message
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const msgTimer = useRef<any>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg({ type, text });
    msgTimer.current = setTimeout(() => setMsg(null), 3000);
  };

  // ── Load data ───────────────────────────────────────────

  const loadKbs = useCallback(async () => {
    setKbLoading(true);
    try {
      const res: any = await aiService.knowledge.listKbs();
      setKbs(res.items || []);
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.loadKbsFail').replace('{msg}', e?.message || ''));
    } finally {
      setKbLoading(false);
    }
  }, [t]);

  const loadRagConfig = useCallback(async () => {
    setRagLoading(true);
    try {
      const res: any = await aiService.ragConfig.get();
      setRagConfig(res);
    } catch (_) {
      // RAG config may fail if not implemented
    } finally {
      setRagLoading(false);
    }
  }, []);

  const loadDocs = useCallback(async (kbId: number) => {
    setDocLoading(true);
    try {
      const res: any = await aiService.knowledge.listDocuments(kbId);
      setDocs(res.items || []);
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.loadDocsFail'));
    } finally {
      setDocLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadKbs();
    loadRagConfig();
    // load model config for embedding/reranker display
    aiService.modelConfig.get().then((res: any) => {
      const items: { key: string; value: string }[] = res?.items || [];
      for (const it of items) {
        if (it.key === 'EMBEDDING_PROVIDER') setEmbeddingProvider(it.value);
        if (it.key === 'EMBEDDING_MODEL') setEmbeddingModel(it.value);
        if (it.key === 'RERANK_PROVIDER') setRerankerProvider(it.value);
        if (it.key === 'RERANK_MODEL') setRerankerModelGlobal(it.value);
      }
    }).catch(() => {});
  }, [loadKbs, loadRagConfig]);

  // ── KB CRUD ─────────────────────────────────────────────

  const handleCreateKb = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await aiService.knowledge.createKb({ name: createName.trim(), description: createDesc.trim() });
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      showMsg('success', t('admin.ui.knowledge.kbCreated'));
      await loadKbs();
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.createFail').replace('{msg}', e?.message || ''));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKb = async (kb: KnowledgeBaseOut) => {
    if (!(await confirm(t('admin.ui.knowledge.deleteKbConfirm').replace('{name}', kb.name)))) return;
    try {
      await aiService.knowledge.deleteKb(kb.id);
      showMsg('success', t('admin.ui.knowledge.kbDeleted'));
      if (selectedKb?.id === kb.id) {
        setView('list');
        setSelectedKb(null);
      }
      await loadKbs();
    } catch (e: any) {
      showMsg('error', t('common.saveFail'));
    }
  };

  const enterKb = (kb: KnowledgeBaseOut) => {
    setSelectedKb(kb);
    setView('detail');
    setDocs([]);
    setSearchResults([]);
    setSearchQuery('');
    loadDocs(kb.id);
  };

  const backToList = () => {
    setView('list');
    setSelectedKb(null);
    setDocs([]);
    setSearchResults([]);
  };

  // ── KB Config ───────────────────────────────────────────

  const enterKbConfig = () => {
    if (!selectedKb) return;
    setKbConfig({ ...selectedKb });
    setEditConfig(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedKb) return;
    setSavingConfig(true);
    try {
      const res: any = await aiService.knowledge.updateKb(selectedKb.id, kbConfig);
      setSelectedKb(res);
      setEditConfig(false);
      showMsg('success', t('admin.ui.knowledge.kbConfigSaved'));
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.configSaveFail').replace('{msg}', e?.message || ''));
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Upload ──────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadFile || !selectedKb) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      await aiService.knowledge.uploadDocument(selectedKb.id, fd);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showMsg('success', t('admin.ui.knowledge.uploadedDone'));
      await loadDocs(selectedKb.id);
    } catch (e: any) {
      const detail = typeof e === 'object' ? (e.detail ? JSON.stringify(e.detail) : e.message || JSON.stringify(e)) : String(e);
      showMsg('error', t('admin.ui.knowledge.uploadFail').replace('{msg}', detail.slice(0, 200)));
    } finally {
      setUploading(false);
    }
  };

  // ── Document actions ────────────────────────────────────

  const handleDeleteDoc = async (docId: number) => {
    if (!(await confirm(t('admin.ui.knowledge.deleteDocConfirm')))) return;
    try {
      await aiService.knowledge.deleteDocument(docId);
      showMsg('success', t('admin.ui.knowledge.docDeleted'));
      if (selectedKb) await loadDocs(selectedKb.id);
    } catch {
      showMsg('error', t('common.saveFail'));
    }
  };

  const handleReprocess = async (docId: number) => {
    try {
      const res: any = await aiService.knowledge.reprocess(docId);
      showMsg('success', t('admin.ui.knowledge.reprocessDone').replace('{n}', String(res.chunks)));
      if (selectedKb) await loadDocs(selectedKb.id);
    } catch {
      showMsg('error', t('admin.ui.knowledge.reprocessFail'));
    }
  };

  // ── Search ──────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedKb) return;
    setSearching(true);
    try {
      const res: any = await aiService.knowledge.search({
        query: searchQuery.trim(),
        kb_id: selectedKb.id,
        top_k: 10,
        threshold: 0.0,
      });
      setSearchResults(res.results || []);
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.searchFail'));
    } finally {
      setSearching(false);
    }
  };

  // ── RAG config ──────────────────────────────────────────

  const toggleRag = async () => {
    if (!ragConfig) return;
    const next = !ragConfig.enabled;
    try {
      await aiService.ragConfig.update({ enabled: next });
      setRagConfig(prev => prev ? { ...prev, enabled: next } : prev);
      showMsg('success', next ? t('admin.ui.knowledge.ragOn') : t('admin.ui.knowledge.ragOff'));
    } catch {
      showMsg('error', t('common.updateFail'));
    }
  };

  const updateRagKbIds = async (kbId: number) => {
    if (!ragConfig) return;
    const current = ragConfig.kb_ids || [];
    const next = current.includes(kbId)
      ? current.filter(id => id !== kbId)
      : [...current, kbId];
    try {
      await aiService.ragConfig.update({ kb_ids: next });
      setRagConfig(prev => prev ? { ...prev, kb_ids: next } : prev);
    } catch {
      showMsg('error', t('common.updateFail'));
    }
  };

  const updateRagParam = async (key: 'top_k' | 'threshold' | 'max_threshold', value: number) => {
    if (!ragConfig) return;
    try {
      await aiService.ragConfig.update({ [key]: value });
      setRagConfig(prev => prev ? { ...prev, [key]: value } : prev);
    } catch {
      showMsg('error', t('common.updateFail'));
    }
  };

  // ── Global sync ─────────────────────────────────────────

  const handleSyncAll = async () => {
    if (!(await confirm(t('admin.ui.knowledge.syncAllConfirm')))) return;
    setSyncing(true);
    showMsg('success', t('admin.ui.knowledge.syncStarting'));
    try {
      const res: any = await adminApi.knowledge.syncAll();
      const data = res?.data || res;
      if (data) {
        showMsg('success', t('admin.ui.knowledge.syncAllDone').replace('{success}', String(data.success)).replace('{fail}', String(data.fail)));
      } else {
        showMsg('success', t('admin.ui.knowledge.syncAllDoneSimple'));
      }
    } catch (e: any) {
      showMsg('error', t('admin.ui.knowledge.syncAllFail').replace('{msg}', e?.message || ''));
    } finally {
      setSyncing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────

  if (kbLoading && kbs.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div>
      {ConfirmDialog}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {view === 'detail' && (
            <button onClick={backToList} className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {view === 'detail' ? selectedKb?.name || t('admin.ui.knowledge.titleDetail') : t('admin.ui.knowledge.titleList')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {view === 'detail' ? selectedKb?.description || t('admin.ui.knowledge.noDesc') : t('admin.ui.knowledge.descList')}
            </p>
          </div>
        </div>
        {view === 'list' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
              title={t('admin.ui.knowledge.syncTitle')}
            >
              <Globe className="w-4 h-4" />
              {syncing ? t('common.syncing') : t('common.syncAll')}
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors">
              <Plus className="w-4 h-4" />
              {t('admin.ui.knowledge.newKb')}
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* RAG Config Bar */}
      {ragConfig && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">{t('admin.ui.knowledge.ragTitle')}</span>
            </div>
            <button
              onClick={toggleRag}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${ragConfig.enabled ? 'bg-black' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ragConfig.enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs text-gray-500">{ragConfig.enabled ? t('common.on') : t('common.off')}</span>

            {ragConfig.enabled && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('admin.ui.knowledge.topK')}</span>
                  <select
                    value={ragConfig.top_k}
                    onChange={e => updateRagParam('top_k', Number(e.target.value))}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    {[1, 3, 5, 6, 10, 15, 20].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                {/* Dual range slider: threshold ~ max_threshold */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('admin.ui.knowledge.similarity')}</span>
                  <div className="relative w-32 h-5">
                    {/* Track background */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full pointer-events-none" />
                    {/* Fill between thumbs */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1 bg-black rounded-full pointer-events-none"
                      style={{
                        left: `${Math.min(ragConfig.threshold, ragConfig.max_threshold ?? 0.7) * 100}%`,
                        width: `${Math.abs((ragConfig.max_threshold ?? 0.7) - ragConfig.threshold) * 100}%`,
                      }}
                    />
                    <style>{`.dr{position:absolute;inset:0;width:100%;height:100%;-webkit-appearance:none;appearance:none;background:transparent;pointer-events:none}.dr::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;background:#000;border-radius:50%;cursor:grab;pointer-events:auto;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}.dr::-moz-range-thumb{width:12px;height:12px;background:#000;border-radius:50%;cursor:grab;pointer-events:auto;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}`}</style>
                    <input type="range" min="0" max="1" step="0.01" value={ragConfig.threshold} onChange={e=>{const v=+e.target.value;if(v<=(ragConfig.max_threshold??.7))updateRagParam('threshold',v)}} className="dr" />
                    <input type="range" min="0" max="1" step="0.01" value={ragConfig.max_threshold??.7} onChange={e=>{const v=+e.target.value;if(v>=ragConfig.threshold)updateRagParam('max_threshold',v)}} className="dr" />
                  </div>
                  <span className="text-xs text-gray-500 w-14 text-right">{Math.round(ragConfig.threshold * 100)}%~{Math.round((ragConfig.max_threshold ?? 0.7) * 100)}%</span>
                </div>
                {/* 重排开关 */}
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-gray-500">{t('admin.ui.knowledge.rerank')}</span>
                  <button
                    onClick={async () => {
                      const next = !ragConfig.reranker_enabled;
                      try {
                        await aiService.ragConfig.update({ reranker_enabled: next });
                        setRagConfig(prev => prev ? { ...prev, reranker_enabled: next } : prev);
                        showMsg('success', next ? t('admin.ui.knowledge.rerankOn') : t('admin.ui.knowledge.rerankOff'));
                      } catch { showMsg('error', t('common.updateFail')); }
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${ragConfig.reranker_enabled ? 'bg-black' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ragConfig.reranker_enabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Create KB Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.ui.knowledge.newKb')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.knowledge.nameReq')}</label>
                <input
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder={t('admin.ui.knowledge.namePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.knowledge.descLabel')}</label>
                <textarea
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  placeholder={t('admin.ui.knowledge.descPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreateKb} disabled={creating || !createName.trim()} className="px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {creating ? t('admin.ui.knowledge.creating') : t('admin.ui.knowledge.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW: Knowledge Base List
          ══════════════════════════════════════════════════════════ */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {kbs.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('admin.ui.knowledge.noKbs')}</p>
              </div>
            ) : (
              kbs.map(kb => (
                <div
                  key={kb.id}
                  onClick={() => enterKb(kb)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Database className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{kb.name}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{kb.description || t('admin.ui.knowledge.noDesc')}</div>
                  </div>
                  <div className="text-xs text-gray-400">{kb.created_at?.slice(0, 10) || ''}</div>
                  {/* 关联到 RAG 开关 */}
                  {ragConfig && (
                    <button
                      onClick={e => { e.stopPropagation(); updateRagKbIds(kb.id); }}
                      className={`relative w-9 h-4 rounded-full transition-colors flex-shrink-0 ${(ragConfig.kb_ids || []).includes(kb.id) ? 'bg-black' : 'bg-gray-200'}`}
                      title={(ragConfig.kb_ids || []).includes(kb.id) ? t('admin.ui.knowledge.associatedRag') : t('admin.ui.knowledge.notAssociatedRag')}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${(ragConfig.kb_ids || []).includes(kb.id) ? 'translate-x-4' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteKb(kb); }}
                    className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW: KB Detail
          ══════════════════════════════════════════════════════════ */}
      {view === 'detail' && selectedKb && (
        <div className="space-y-6">
          {/* Upload area */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">{t('admin.ui.knowledge.uploadDoc')}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.docx,.csv"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:bg-gray-50 hover:file:bg-gray-100"
              />
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {uploading ? t('admin.ui.knowledge.processing') : t('admin.ui.knowledge.uploadAndProcess')}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('admin.ui.knowledge.uploadHint')}</p>
          </div>

          {/* ── KB 配置面板 ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">{t('admin.ui.knowledge.kbConfigTitle')}</h2>
              </div>
              <button
                onClick={editConfig ? () => { setEditConfig(false); setKbConfig({ ...selectedKb }); }
                  : enterKbConfig}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {editConfig ? t('common.cancel') : t('common.edit')}
              </button>
            </div>
            <div className="p-5 space-y-5">
              {editConfig ? (
                /* ── 编辑模式 ── */
                <div className="space-y-5">
                  {/* 分块配置 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Scissors className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{t('admin.ui.knowledge.chunkConfig')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.chunkSize')}</label>
                        <input type="number" value={kbConfig.chunk_size ?? 1024}
                          onChange={e => setKbConfig(p => ({ ...p, chunk_size: parseInt(e.target.value) || 1024 }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.chunkOverlap')}</label>
                        <input type="number" value={kbConfig.chunk_overlap ?? 50}
                          onChange={e => setKbConfig(p => ({ ...p, chunk_overlap: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.chunkSeparator')}</label>
                        <input type="text"
                          value={(kbConfig.chunk_separator ?? '\\n\\n').replace(/\n/g, '\\n')}
                          onChange={e => setKbConfig(p => ({ ...p, chunk_separator: e.target.value.replace(/\\n/g, '\n') }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 font-mono" />
                      </div>
                    </div>
                  </div>

                  {/* 文本预处理 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{t('admin.ui.knowledge.textPreprocess')}</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'trim_whitespace', label: t('admin.ui.knowledge.ruleTrim') },
                        { key: 'remove_urls_emails', label: t('admin.ui.knowledge.ruleRemove') },
                      ].map(rule => {
                        const rules = kbConfig.text_preprocessing_rules || [];
                        const checked = rules.includes(rule.key);
                        return (
                          <label key={rule.key} className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? rules.filter(r => r !== rule.key)
                                  : [...rules, rule.key];
                                setKbConfig(p => ({ ...p, text_preprocessing_rules: next }));
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black" />
                            <span className="text-sm text-gray-600">{rule.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 检索设置 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{t('admin.ui.knowledge.retrievalSettings')}</span>
                    </div>
                    <div className="max-w-xs">
                      <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.topKField')}</label>
                      <input type="number" value={kbConfig.top_k ?? 6}
                        onChange={e => setKbConfig(p => ({ ...p, top_k: parseInt(e.target.value) || 6 }))}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
                    </div>
                  </div>

                  {/* 嵌入模型 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Cpu className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{t('admin.ui.knowledge.embeddingModel')}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{t('admin.ui.knowledge.embeddingCurrent').replace('{model}', `${embeddingProvider}-${embeddingModel}`)}{kbConfig.embedding_model ? t('admin.ui.knowledge.kbOverride').replace('{model}', kbConfig.embedding_model) : ''}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.embeddingOverride')}</label>
                        <input type="text" value={kbConfig.embedding_model ?? ''}
                          onChange={e => setKbConfig(p => ({ ...p, embedding_model: e.target.value || '' }))}
                          placeholder={t('admin.ui.knowledge.embeddingBlank')}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.knowledge.embeddingDimOverride')}</label>
                        <input type="number" value={kbConfig.embedding_dimension || ''}
                          onChange={e => setKbConfig(p => ({ ...p, embedding_dimension: e.target.value ? parseInt(e.target.value) : null as any }))}
                          placeholder={embeddingModel.includes('1024') ? '1024' : ''}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10" />
                      </div>
                    </div>
                  </div>

                  {/* 重排模型 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GripHorizontal className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{t('admin.ui.knowledge.rerankModel')}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {rerankerProvider && rerankerModelGlobal
                        ? t('admin.ui.knowledge.rerankGlobal').replace('{model}', `${rerankerProvider}-${rerankerModelGlobal}`)
                        : t('admin.ui.knowledge.rerankNone')}
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <button
                          onClick={() => setKbConfig(p => ({ ...p, reranker_enabled: !p.reranker_enabled }))}
                          className={`relative w-10 h-5 rounded-full transition-colors ${kbConfig.reranker_enabled ? 'bg-black' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${kbConfig.reranker_enabled ? 'translate-x-5' : ''}`} />
                        </button>
                        <span className="text-sm text-gray-600">{t('admin.ui.knowledge.rerankEnable')}</span>
                      </label>
                      <input type="text" value={kbConfig.reranker_model ?? ''}
                        onChange={e => setKbConfig(p => ({ ...p, reranker_model: e.target.value || '' }))}
                        placeholder={t('admin.ui.knowledge.rerankOverridePlaceholder')}
                        disabled={!kbConfig.reranker_enabled}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 disabled:bg-gray-50" />
                    </div>
                  </div>

                  {/* 保存按钮 */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {savingConfig ? t('common.saving') : t('common.saveConfig')}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 只读展示 ── */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.chunkSize')}</span>
                    <span className="font-medium">{selectedKb.chunk_size || 1024}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.chunkOverlap')}</span>
                    <span className="font-medium">{selectedKb.chunk_overlap || 50}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.chunkSeparator')}</span>
                    <span className="font-medium font-mono">{(selectedKb.chunk_separator || '\\n\\n').replace(/\n/g, '\\n')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.topKField')}</span>
                    <span className="font-medium">{selectedKb.top_k || 6}</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.textPreprocess')}</span>
                    <span className="font-medium">{(selectedKb.text_preprocessing_rules || []).length > 0 ? (selectedKb.text_preprocessing_rules || []).join(', ') : t('admin.ui.knowledge.none')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.embeddingModel')}</span>
                    <span className="font-medium">
                      {selectedKb.embedding_model
                        ? `${selectedKb.embedding_model}${selectedKb.embedding_dimension ? t('admin.ui.knowledge.dimSuffix').replace('{n}', String(selectedKb.embedding_dimension)) : ''}`
                        : `${embeddingProvider}-${embeddingModel}`
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">{t('admin.ui.knowledge.rerankModel')}</span>
                    <span className="font-medium">
                      {selectedKb.reranker_enabled
                        ? (selectedKb.reranker_model || (rerankerProvider && rerankerModelGlobal ? `${rerankerProvider}-${rerankerModelGlobal}` : t('admin.ui.knowledge.rerankEnabled')))
                        : (rerankerProvider && rerankerModelGlobal ? `${rerankerProvider}-${rerankerModelGlobal}` : t('admin.ui.knowledge.rerankNotEnabled'))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900">{t('admin.ui.knowledge.docListTitle')}</h2>
            </div>
            {docLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
              </div>
            ) : docs.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('admin.ui.knowledge.noDocs')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {docs.map(doc => {
                  const st = STATUS_KEYS[doc.status] || { labelKey: 'admin.ui.knowledge.docStatus0', color: 'text-gray-600 bg-gray-50' };
                  return (
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-4 group">
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{doc.title}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          {doc.file_name && <span>{doc.file_name}</span>}
                          {doc.file_size > 0 && <span>{fmtSize(doc.file_size)}</span>}
                          <span>{t('admin.ui.knowledge.chunkCount').replace('{n}', String(doc.chunk_count))}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>{t(st.labelKey)}</span>
                      <button
                        onClick={() => handleReprocess(doc.id)}
                        className="p-1.5 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
                        title={t('admin.ui.knowledge.reprocessTitle')}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Test */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t('admin.ui.knowledge.searchTitle')}</h2>
              <span title={t('admin.ui.knowledge.searchTitle')}><Info className="w-4 h-4 text-gray-400" /></span>
            </div>
            <div className="p-5">
              <div className="flex gap-3">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={t('admin.ui.knowledge.searchPlaceholder')}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <SearchIcon className="w-4 h-4" />
                  {t('admin.ui.knowledge.search')}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  {searchResults.map(r => (
                    <div key={r.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {r.doc_title} {t('admin.ui.knowledge.chunkBadge').replace('{n}', String(r.chunk_index))}
                          {r.media_type && r.media_type !== 'text' && (
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${r.media_type === 'image' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                              {r.media_type === 'image' ? t('admin.ui.knowledge.mediaImage') : t('admin.ui.knowledge.mediaDoc')}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">{t('admin.ui.knowledge.similarityLabel').replace('{p}', (r.similarity * 100).toFixed(1))}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-4">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && !searching && searchResults.length === 0 && (
                <p className="mt-3 text-sm text-gray-400 text-center">{t('admin.ui.knowledge.noMatch')}</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
