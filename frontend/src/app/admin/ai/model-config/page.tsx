'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi } from '@/lib/adminApi';
import { aiService } from '@/lib/aiService';
import {
  Save, RotateCcw, Search, Check, AlertCircle,
  Bot, FileText, Image, Database, Cable, Eye, EyeOff
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { encryptSecret, SECRET_MASK } from '@/lib/secretCrypto';

interface FieldDef {
  key: string;
  labelKey: string;
  type: 'number' | 'text' | 'password' | 'boolean' | 'slider';
  step?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  placeholderKey?: string;
  descriptionKey?: string;
  group: string;
}

const AI_KEY_PREFIXES = ['LLM_', 'EMBEDDING_', 'VL_', 'RERANK_'];

/** 需要掩码 + 加密传输 + 仅修改（不可回显）的密钥字段。 */
const SECRET_FIELD_KEYS = new Set(
  FIELD_DEFS.filter((f) => f.type === 'password').map((f) => f.key),
);

function isSecretKey(key: string) {
  return SECRET_FIELD_KEYS.has(key);
}

const FIELD_DEFS: FieldDef[] = [
  // ── LLM 模型配置 ──
  { key: 'LLM_PROVIDER', labelKey: 'admin.ui.modelConfig.fields.LLM_PROVIDER', type: 'text', placeholder: 'openai / azure / ollama', group: 'llm' },
  { key: 'LLM_BASE_URL', labelKey: 'admin.ui.modelConfig.fields.LLM_BASE_URL', type: 'text', placeholder: 'https://api.openai.com/v1', group: 'llm' },
  { key: 'LLM_API_KEY', labelKey: 'admin.ui.modelConfig.fields.LLM_API_KEY', type: 'password', placeholder: 'sk-...', descriptionKey: 'admin.ui.modelConfig.descs.LLM_API_KEY', group: 'llm' },
  { key: 'LLM_MODEL', labelKey: 'admin.ui.modelConfig.fields.LLM_MODEL', type: 'text', placeholder: 'gpt-4o / qwen3.5:35b', group: 'llm' },
  { key: 'LLM_TEMPERATURE', labelKey: 'admin.ui.modelConfig.fields.LLM_TEMPERATURE', type: 'slider', step: '0.1', min: 0, max: 2, descriptionKey: 'admin.ui.modelConfig.descs.LLM_TEMPERATURE', group: 'llm' },
  { key: 'LLM_MAX_TOKENS', labelKey: 'admin.ui.modelConfig.fields.LLM_MAX_TOKENS', type: 'number', min: 1, max: 131072, descriptionKey: 'admin.ui.modelConfig.descs.LLM_MAX_TOKENS', group: 'llm' },
  { key: 'LLM_TOP_P', labelKey: 'admin.ui.modelConfig.fields.LLM_TOP_P', type: 'slider', step: '0.05', min: 0, max: 1, descriptionKey: 'admin.ui.modelConfig.descs.LLM_TOP_P', group: 'llm' },
  { key: 'LLM_FREQUENCY_PENALTY', labelKey: 'admin.ui.modelConfig.fields.LLM_FREQUENCY_PENALTY', type: 'slider', step: '0.1', min: -2, max: 2, descriptionKey: 'admin.ui.modelConfig.descs.LLM_FREQUENCY_PENALTY', group: 'llm' },
  { key: 'LLM_PRESENCE_PENALTY', labelKey: 'admin.ui.modelConfig.fields.LLM_PRESENCE_PENALTY', type: 'slider', step: '0.1', min: -2, max: 2, descriptionKey: 'admin.ui.modelConfig.descs.LLM_PRESENCE_PENALTY', group: 'llm' },
  { key: 'LLM_SEED', labelKey: 'admin.ui.modelConfig.fields.LLM_SEED', type: 'number', placeholderKey: 'admin.ui.modelConfig.seedPlaceholder', descriptionKey: 'admin.ui.modelConfig.descs.LLM_SEED', group: 'llm' },
  { key: 'LLM_STOP', labelKey: 'admin.ui.modelConfig.fields.LLM_STOP', type: 'text', placeholderKey: 'admin.ui.modelConfig.stopPlaceholder', group: 'llm' },
  { key: 'LLM_THINKING_KEYWORD', labelKey: 'admin.ui.modelConfig.fields.LLM_THINKING_KEYWORD', type: 'text', placeholderKey: 'admin.ui.modelConfig.thinkingPlaceholder', group: 'llm' },
  { key: 'LLM_THINKING_ENABLED', labelKey: 'admin.ui.modelConfig.fields.LLM_THINKING_ENABLED', type: 'boolean', descriptionKey: 'admin.ui.modelConfig.descs.LLM_THINKING_ENABLED', group: 'llm' },
  { key: 'LLM_THINKING_AUTO_COLLAPSE', labelKey: 'admin.ui.modelConfig.fields.LLM_THINKING_AUTO_COLLAPSE', type: 'boolean', descriptionKey: 'admin.ui.modelConfig.descs.LLM_THINKING_AUTO_COLLAPSE', group: 'llm' },

  // ── Embedding 模型配置 ──
  { key: 'EMBEDDING_PROVIDER', labelKey: 'admin.ui.modelConfig.fields.EMBEDDING_PROVIDER', type: 'text', placeholder: 'openai / azure / ollama', group: 'embedding' },
  { key: 'EMBEDDING_BASE_URL', labelKey: 'admin.ui.modelConfig.fields.EMBEDDING_BASE_URL', type: 'text', placeholder: 'https://api.openai.com/v1', group: 'embedding' },
  { key: 'EMBEDDING_API_KEY', labelKey: 'admin.ui.modelConfig.fields.EMBEDDING_API_KEY', type: 'password', placeholder: 'sk-...', group: 'embedding' },
  { key: 'EMBEDDING_MODEL', labelKey: 'admin.ui.modelConfig.fields.EMBEDDING_MODEL', type: 'text', placeholder: 'text-embedding-3-small', group: 'embedding' },
  { key: 'EMBEDDING_DIMENSION', labelKey: 'admin.ui.modelConfig.fields.EMBEDDING_DIMENSION', type: 'number', min: 64, max: 8192, descriptionKey: 'admin.ui.modelConfig.descs.EMBEDDING_DIMENSION', group: 'embedding' },

  // ── VL 模型配置 ──
  { key: 'VL_PROVIDER', labelKey: 'admin.ui.modelConfig.fields.VL_PROVIDER', type: 'text', placeholder: 'openai / azure', group: 'vl' },
  { key: 'VL_BASE_URL', labelKey: 'admin.ui.modelConfig.fields.VL_BASE_URL', type: 'text', placeholder: 'https://api.openai.com/v1', group: 'vl' },
  { key: 'VL_API_KEY', labelKey: 'admin.ui.modelConfig.fields.VL_API_KEY', type: 'password', placeholder: 'sk-...', group: 'vl' },
  { key: 'VL_MODEL', labelKey: 'admin.ui.modelConfig.fields.VL_MODEL', type: 'text', placeholder: 'gpt-4o / qwen3.5:35b', group: 'vl' },
  { key: 'VL_TEMPERATURE', labelKey: 'admin.ui.modelConfig.fields.VL_TEMPERATURE', type: 'slider', step: '0.1', min: 0, max: 2, descriptionKey: 'admin.ui.modelConfig.descs.VL_TEMPERATURE', group: 'vl' },
  { key: 'VL_MAX_TOKENS', labelKey: 'admin.ui.modelConfig.fields.VL_MAX_TOKENS', type: 'number', min: 1, max: 131072, descriptionKey: 'admin.ui.modelConfig.descs.VL_MAX_TOKENS', group: 'vl' },
  { key: 'VL_IMAGE_SIZE', labelKey: 'admin.ui.modelConfig.fields.VL_IMAGE_SIZE', type: 'text', placeholder: '1024x1024', group: 'vl' },
  { key: 'VL_IMAGE_QUALITY', labelKey: 'admin.ui.modelConfig.fields.VL_IMAGE_QUALITY', type: 'text', placeholder: 'standard / hd', group: 'vl' },

  // ── Rerank 模型配置 ──
  { key: 'RERANK_PROVIDER', labelKey: 'admin.ui.modelConfig.fields.RERANK_PROVIDER', type: 'text', placeholder: 'rerank provider', group: 'rerank' },
  { key: 'RERANK_BASE_URL', labelKey: 'admin.ui.modelConfig.fields.RERANK_BASE_URL', type: 'text', placeholder: 'https://api.rerank.com/v1', group: 'rerank' },
  { key: 'RERANK_API_KEY', labelKey: 'admin.ui.modelConfig.fields.RERANK_API_KEY', type: 'password', placeholder: 'sk-...', group: 'rerank' },
  { key: 'RERANK_MODEL', labelKey: 'admin.ui.modelConfig.fields.RERANK_MODEL', type: 'text', placeholder: 'rerank model', group: 'rerank' },
  { key: 'RERANK_ENABLED', labelKey: 'admin.ui.modelConfig.fields.RERANK_ENABLED', type: 'boolean', descriptionKey: 'admin.ui.modelConfig.descs.RERANK_ENABLED', group: 'rerank' },
  { key: 'RERANK_TOP_K', labelKey: 'admin.ui.modelConfig.fields.RERANK_TOP_K', type: 'number', min: 1, max: 100, descriptionKey: 'admin.ui.modelConfig.descs.RERANK_TOP_K', group: 'rerank' },
];

const GROUPS = [
  { key: 'llm', labelKey: 'admin.ui.modelConfig.groups.llm', icon: Bot, descKey: 'admin.ui.modelConfig.groups.desc' },
  { key: 'embedding', labelKey: 'admin.ui.modelConfig.groups.embedding', icon: FileText, descKey: 'admin.ui.modelConfig.groups.desc' },
  { key: 'vl', labelKey: 'admin.ui.modelConfig.groups.vl', icon: Image, descKey: 'admin.ui.modelConfig.groups.desc' },
  { key: 'rerank', labelKey: 'admin.ui.modelConfig.groups.rerank', icon: Database, descKey: 'admin.ui.modelConfig.groups.desc' },
];

function isAiKey(key: string) {
  return AI_KEY_PREFIXES.some(p => key.startsWith(p));
}

export default function AdminModelConfigPage() {
  const { t } = useI18n();
  const [allItems, setAllItems] = useState<Array<{ key: string; value: string }>>([]);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [search, setSearch] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ model_type: string; success: boolean; message: string; latency_ms: number } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.envConfigs.list();
      setAllItems(res.data || []);
      setPending({});
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.modelConfig.loadFail') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const aiItems = useMemo(() => allItems.filter(i => i.value && isAiKey(i.key)), [allItems]);

  const valueMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const item of aiItems) m[item.key] = item.value;
    return m;
  }, [aiItems]);

  const getDisplayValue = (key: string): string => {
    if (pending[key] !== undefined) return pending[key];
    return valueMap[key] ?? '';
  };

  const isChanged = (key: string) => pending[key] !== undefined;

  const handleChange = (key: string, value: string) => {
    const dropPending = () => {
      setPending(prev => { const n = { ...prev }; delete n[key]; return n; });
    };
    if (!value) {
      // 密钥字段留空 = 不修改（保留原值）；普通字段空串表示清空
      if (isSecretKey(key)) {
        dropPending();
      } else if (!valueMap[key]) {
        dropPending();
      } else {
        setPending(prev => ({ ...prev, [key]: value }));
      }
      return;
    }
    setPending(prev => ({ ...prev, [key]: value }));
  };

  const handleRevert = (key: string) => {
    setPending(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleRevertAll = () => setPending({});

  const handleTest = async (modelType: string) => {
    setTesting(modelType);
    setTestResult(null);
    setMessage(null);
    try {
      const res: any = await aiService.modelConfig.test(modelType);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ model_type: modelType, success: false, message: e?.message || t('admin.ui.modelConfig.testFail'), latency_ms: 0 });
    } finally {
      setTesting(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // 密钥字段用 RSA 公钥加密后再提交，密文不外泄明文；留空项不提交（后端保留原值）
      const payload: Array<{ key: string; value: string }> = [];
      const plainPayload: Array<{ key: string; value: string }> = [];
      for (const [key, value] of Object.entries(pending)) {
        if (isSecretKey(key)) {
          if (!value.trim()) continue;
          payload.push({ key, value: await encryptSecret(value) });
        } else {
          payload.push({ key, value });
          plainPayload.push({ key, value });
        }
      }
      await adminApi.envConfigs.update(payload);
      try { await aiService.modelConfig.save({ items: plainPayload }); } catch {}
      await fetchData();
      setMessage({ type: 'success', text: t('admin.ui.modelConfig.savedMsg') });
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.modelConfig.saveFailMsg') });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const filteredFields = useMemo(() => {
    if (!search) return FIELD_DEFS;
    const q = search.toLowerCase();
    return FIELD_DEFS.filter(f =>
      t(f.labelKey).toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      f.group.toLowerCase().includes(q)
    );
  }, [search, t]);

  const hasPending = Object.keys(pending).length > 0;

  const activeGroupDef = GROUPS.find(g => g.key === activeTab);
  const tabFields = filteredFields.filter(f => f.group === activeTab);

  const groupChangeCount = (group: string) =>
    FIELD_DEFS.filter(f => f.group === group && isChanged(f.key)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-black" />
          <span className="text-sm text-gray-400">{t('admin.ui.modelConfig.loadFail')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.ui.modelConfig.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.modelConfig.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPending && (
            <button onClick={handleRevertAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-black border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
              {t('admin.ui.modelConfig.revertAll')}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !hasPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Save className="w-3.5 h-3.5" />
            {saving ? t('common.saving') : t('common.saveConfig')}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('admin.ui.modelConfig.searchPlaceholder')}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {GROUPS.map(g => {
          const Icon = g.icon;
          const changed = groupChangeCount(g.key);
          const isActive = activeTab === g.key;
          return (
            <button key={g.key} onClick={() => setActiveTab(g.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
              }`}>
              <Icon className="w-4 h-4" />
              {t(g.labelKey)}
              {changed > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full">
                  {changed}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Group description & test button */}
      {activeGroupDef && !search && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <activeGroupDef.icon className="w-3.5 h-3.5" />
            <span>{t(activeGroupDef.descKey)}</span>
          </div>
          <div className="flex items-center gap-3">
            {testResult && testResult.model_type === activeTab && (
              <div className={`flex items-center gap-1.5 text-xs ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{testResult.message}</span>
                <span className="text-gray-400 ml-1">{testResult.latency_ms > 0 ? `${testResult.latency_ms}ms` : ''}</span>
              </div>
            )}
            <button onClick={() => handleTest(activeTab)} disabled={testing !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <Cable className="w-3 h-3" />
              {testing === activeTab ? t('admin.ui.modelConfig.testing') : t('admin.ui.modelConfig.testTitle')}
            </button>
          </div>
        </div>
      )}

      {/* Fields */}
      {tabFields.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {search ? t('admin.ui.modelConfig.noMatch') : t('admin.ui.modelConfig.groupEmpty')}
        </div>
      ) : (
        <div className="space-y-3">
          {tabFields.map(field => {
            const val = getDisplayValue(field.key);
            const changed = isChanged(field.key);
            const isSecret = isSecretKey(field.key);
            const secretConfigured = isSecret && valueMap[field.key] === SECRET_MASK;
            const typed = isSecret && changed;
            const inputValue = isSecret ? (typed ? val : '') : val;
            const inputPlaceholder = isSecret
              ? (secretConfigured
                  ? t('admin.ui.modelConfig.secretConfiguredHint')
                  : (field.placeholderKey ? t(field.placeholderKey) : field.placeholder))
              : (field.placeholderKey ? t(field.placeholderKey) : field.placeholder);
            return (
              <div key={field.key}
                className={`rounded-xl border transition-all ${
                  changed
                    ? 'border-amber-200 bg-amber-50/40 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-sm font-medium text-gray-900">{t(field.labelKey)}</label>
                        {changed && (
                          <span className="text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                            {t('admin.ui.modelConfig.changed')}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 font-mono ml-auto">{field.key}</span>
                      </div>
                      {field.descriptionKey && (
                        <p className="text-xs text-gray-400 mb-2.5">{t(field.descriptionKey)}</p>
                      )}
                      {field.type === 'boolean' ? (
                        <div className="flex items-center gap-3 mt-1">
                          <button type="button"
                            onClick={() => handleChange(field.key, val === 'true' ? 'false' : 'true')}
                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                              val === 'true' ? 'bg-black' : 'bg-gray-300'
                            }`}>
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                              val === 'true' ? 'translate-x-5' : ''
                            }`} />
                          </button>
                          <span className="text-sm text-gray-600">{val === 'true' ? t('admin.ui.modelConfig.boolOn') : t('admin.ui.modelConfig.boolOff')}</span>
                        </div>
                      ) : field.type === 'slider' ? (
                        <div className="flex items-center gap-3 mt-1">
                          <input type="range"
                            min={field.min} max={field.max} step={field.step || '1'}
                            value={val || field.min || 0}
                            onChange={e => handleChange(field.key, e.target.value)}
                            className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black" />
                          <input type="number"
                            value={val}
                            onChange={e => handleChange(field.key, e.target.value)}
                            min={field.min} max={field.max} step={field.step || '1'}
                            className="w-20 px-2.5 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black" />
                        </div>
                      ) : (
                        <div className="relative mt-1">
                          <input
                            type={field.type === 'password' && !showKeys[field.key] ? 'password' : 'text'}
                            value={inputValue}
                            onChange={e => handleChange(field.key, e.target.value)}
                            placeholder={inputPlaceholder}
min={field.min}
                            max={field.max}
                            step={field.step}
                            autoComplete="off"
                            className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-colors"
                          />
                          {field.type === 'password' && (
                            <button type="button" onClick={() => setShowKeys(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                              {showKeys[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {changed && (
                      <button onClick={() => handleRevert(field.key)}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
                        title={t('admin.ui.modelConfig.revertTitle')}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar */}
      {hasPending && (
        <div className="mt-6 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-amber-800">
            {t('admin.ui.modelConfig.pendingCount').replace('{n}', String(Object.keys(pending).length))}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleRevertAll}
              className="px-3 py-1.5 text-sm text-amber-700 hover:text-amber-900 transition-colors">
              {t('admin.ui.modelConfig.revertAllShort')}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {saving ? t('common.saving') : t('admin.ui.modelConfig.saveChanges')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
