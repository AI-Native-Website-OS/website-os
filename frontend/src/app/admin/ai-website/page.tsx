'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { useI18n } from '@/i18n/I18nProvider';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { Save, Loader2, Plus, Trash2, Star, Layers, Power } from 'lucide-react';
import type { AiWebsiteConfig, AiWebsiteVersionItem, AiWebsiteComparisonRow } from '@/types';

const CONFIG_KEY = 'ai_website_config';

const DEFAULT_CONFIG: AiWebsiteConfig = {
  title: 'AI 企业官网 · 版本介绍',
  subtitle: '从内容管理到 AI 顾问，选择适合您企业规模的版本',
  comparisonTitle: '功能对比',
  versions: [
    {
      key: 'basic', name: '基础版', tagline: '适合个人与初创团队', price: '¥0', priceNote: '开源免费',
      description: '快速搭建品牌官网，内置内容管理与 AI 顾问体验。',
      features: ['官网内容管理（产品/方案/案例/资源）', 'AI 智能顾问（每日限量）', '中英双语界面', '线索采集与后台管理'],
      highlight: false, ctaLabel: '免费体验', ctaUrl: '/#chat',
    },
    {
      key: 'pro', name: '专业版', tagline: '适合成长型企业', price: '¥399', priceNote: '每月',
      description: '在基础版之上，解锁完整 AI 能力与营销分析。',
      features: ['基础版全部功能', 'AI 顾问不限量 + 知识库 RAG', 'AI 长期记忆与意图识别', '用户行为追踪与转化分析', 'SEO / GEO 自动优化', '优先技术支持'],
      highlight: true, ctaLabel: '立即升级', ctaUrl: '/#chat',
    },
    {
      key: 'enterprise', name: '旗舰版', tagline: '适合大型企业 / 集团', price: '定制', priceNote: '联系我们',
      description: '专属私有化部署，多站点多语言与深度定制。',
      features: ['专业版全部功能', '私有化部署（本地/专有云）', '多站点 / 多语言 / 品牌定制', '专属模型微调与知识库', '专属客户成功经理'],
      highlight: false, ctaLabel: '联系我们', ctaUrl: '/about#contact',
    },
  ],
  comparisonRows: [
    { feature: '官网内容管理', values: { basic: '✓', pro: '✓', enterprise: '✓' } },
    { feature: 'AI 智能顾问', values: { basic: '每日限量', pro: '不限量', enterprise: '不限量' } },
    { feature: '知识库 RAG 检索', values: { basic: '—', pro: '✓', enterprise: '✓' } },
    { feature: 'AI 长期记忆', values: { basic: '—', pro: '✓', enterprise: '✓' } },
    { feature: '用户行为追踪', values: { basic: '基础', pro: '✓', enterprise: '✓' } },
    { feature: '中英双语', values: { basic: '✓', pro: '✓', enterprise: '✓' } },
    { feature: 'SEO / GEO 优化', values: { basic: '—', pro: '✓', enterprise: '✓' } },
    { feature: '私有化部署', values: { basic: '—', pro: '—', enterprise: '✓' } },
    { feature: '专属模型定制', values: { basic: '—', pro: '—', enterprise: '✓' } },
    { feature: '技术支持', values: { basic: '社区', pro: '优先', enterprise: '专属' } },
  ],
};

function inputCls(dark: boolean, extra = '') {
  return `${dark ? 'border-gray-600 bg-transparent text-gray-100 placeholder:text-gray-400' : 'border-gray-300'} w-full px-3 py-2 border rounded-lg text-sm ${extra}`;
}

function remapRowValues(row: AiWebsiteComparisonRow, keys: string[]): AiWebsiteComparisonRow {
  const values: Record<string, string> = {};
  keys.forEach(k => { values[k] = row.values[k] ?? '—'; });
  return { ...row, values };
}

export default function AdminAiWebsitePage() {
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [config, setConfig] = useState<AiWebsiteConfig>(DEFAULT_CONFIG);

  const versionEnabled = siteConfig.versionEnabled !== false;

  const handleToggle = async () => {
    setToggling(true);
    setMessage(null);
    try {
      const next = !versionEnabled;
      await adminApi.systemConfigs.save({
        configKey: 'site_brand',
        configValue: JSON.stringify({ ...siteConfig, versionEnabled: next }),
        configType: 'system',
        description: 'site_brand',
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('site-config-changed'));
      setMessage({ type: 'success', text: next ? t('admin.ui.aiWebsite.versionEnabled') : t('admin.ui.aiWebsite.versionDisabled') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || t('common.saveFail') });
    } finally {
      setToggling(false);
    }
  };


  useEffect(() => {
    adminApi.systemConfigs.get(CONFIG_KEY)
      .then((res: any) => {
        if (res.data?.configValue) {
          const parsed = JSON.parse(res.data.configValue);
          setConfig(prev => ({
            title: parsed.title || prev.title,
            subtitle: parsed.subtitle || prev.subtitle,
            comparisonTitle: parsed.comparisonTitle || prev.comparisonTitle,
            versions: parsed.versions?.length ? parsed.versions : prev.versions,
            comparisonRows: parsed.comparisonRows?.length ? parsed.comparisonRows : prev.comparisonRows,
          }));
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateVersion = (idx: number, patch: Partial<AiWebsiteVersionItem>) => {
    setConfig(prev => ({
      ...prev,
      versions: (prev.versions || []).map((v, i) => i === idx ? { ...v, ...patch } : v),
    }));
  };

  const addVersion = () => {
    setConfig(prev => ({
      ...prev,
      versions: [...(prev.versions || []), {
        key: `v${Date.now()}`, name: '新版本', tagline: '', price: '', priceNote: '',
        description: '', features: [], highlight: false, ctaLabel: '了解更多', ctaUrl: '/#chat',
      }],
    }));
  };

  const removeVersion = (idx: number) => {
    setConfig(prev => {
      const versions = (prev.versions || []).filter((_, i) => i !== idx);
      const keys = versions.map(v => v.key);
      const comparisonRows = (prev.comparisonRows || []).map(row => remapRowValues(row, keys));
      return { ...prev, versions, comparisonRows };
    });
  };

  const updateRowFeature = (idx: number, feature: string) => {
    setConfig(prev => ({
      ...prev,
      comparisonRows: (prev.comparisonRows || []).map((r, i) => i === idx ? { ...r, feature } : r),
    }));
  };

  const updateRow = (idx: number, feature: string, versionKey: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      comparisonRows: (prev.comparisonRows || []).map((r, i) =>
        i === idx ? { ...r, feature, values: { ...r.values, [versionKey]: value } } : r
      ),
    }));
  };

  const addRow = () => {
    setConfig(prev => {
      const keys = (prev.versions || []).map(v => v.key);
      const values: Record<string, string> = {};
      keys.forEach(k => { values[k] = '✓'; });
      return { ...prev, comparisonRows: [...(prev.comparisonRows || []), { feature: '新功能', values }] };
    });
  };

  const removeRow = (idx: number) => {
    setConfig(prev => ({
      ...prev,
      comparisonRows: (prev.comparisonRows || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.systemConfigs.save({
        configKey: CONFIG_KEY,
        configValue: JSON.stringify(config),
        configType: 'ai-website',
        description: 'AI 官网版本介绍与对比配置',
      });
      setMessage({ type: 'success', text: t('admin.ui.aiWebsite.savedMsg') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || t('common.saveFail') });
    } finally {
      setSaving(false);
    }
  };

  const versions = config.versions || DEFAULT_CONFIG.versions || [];
  const rows = config.comparisonRows || DEFAULT_CONFIG.comparisonRows || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-gray-400" /> {t('admin.page.aiWebsite')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.aiWebsite.subtitle')}</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
            versionEnabled
              ? 'text-red-600 border-red-300 hover:bg-red-50'
              : 'text-green-600 border-green-300 hover:bg-green-50'
          }`}
        >
          <Power className="w-4 h-4" />
          {toggling ? t('common.saving') : versionEnabled ? t('admin.ui.aiWebsite.disableVersion') : t('admin.ui.aiWebsite.enableVersion')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') : t('common.saveConfig')}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 页面标题 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('admin.ui.aiWebsite.pageTitle')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.aiWebsite.mainTitle')}</label>
                <input
                  value={config.title || ''}
                  onChange={e => setConfig({ ...config, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('admin.ui.aiWebsite.subtitleLabel')}</label>
                <input
                  value={config.subtitle || ''}
                  onChange={e => setConfig({ ...config, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* 版本卡片 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('admin.ui.aiWebsite.versionCards')}</h2>
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, versions.length + 1)}, minmax(240px, 1fr))` }}
              >
                {(versions || []).map((v, idx) => (
                  <div
                    key={v.key}
                    className={`relative flex flex-col rounded-xl border p-4 ${v.highlight ? 'border-black bg-gradient-to-b from-black to-gray-900 text-white' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <input
                        value={v.name || ''}
                        onChange={e => updateVersion(idx, { name: e.target.value })}
                        className={`${inputCls(!!v.highlight)} text-base font-bold`}
                        placeholder={t('admin.ui.aiWebsite.namePlaceholder')}
                      />
                      <button
                        onClick={() => removeVersion(idx)}
                        className={`p-1.5 rounded-lg shrink-0 ${v.highlight ? 'text-gray-300 hover:text-red-400 hover:bg-white/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        value={v.tagline || ''}
                        onChange={e => updateVersion(idx, { tagline: e.target.value })}
                        className={inputCls(!!v.highlight)}
                        placeholder={t('admin.ui.aiWebsite.taglinePlaceholder')}
                      />
                      <div className="flex gap-2">
                        <input
                          value={v.price || ''}
                          onChange={e => updateVersion(idx, { price: e.target.value })}
                          className={`${inputCls(!!v.highlight)} font-semibold`}
                          placeholder={t('admin.ui.aiWebsite.pricePlaceholder')}
                        />
                        <input
                          value={v.priceNote || ''}
                          onChange={e => updateVersion(idx, { priceNote: e.target.value })}
                          className={inputCls(!!v.highlight)}
                          placeholder={t('admin.ui.aiWebsite.priceNotePlaceholder')}
                        />
                      </div>
                      <button
                        onClick={() => updateVersion(idx, { highlight: !v.highlight })}
                        className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs border ${v.highlight ? 'bg-white text-black border-white' : 'border-gray-300 text-gray-500'}`}
                        title={t('admin.ui.aiWebsite.recommendTitle')}
                      >
                        <Star className={`w-3 h-3 ${v.highlight ? 'text-yellow-400' : ''}`} /> {t('admin.ui.aiWebsite.recommend')}
                      </button>
                      <textarea
                        value={v.description || ''}
                        onChange={e => updateVersion(idx, { description: e.target.value })}
                        rows={2}
                        className={inputCls(!!v.highlight)}
                        placeholder={t('admin.ui.aiWebsite.descPlaceholder')}
                      />
                      <div>
                        <label className={`block text-xs mb-1 ${v.highlight ? 'text-gray-300' : 'text-gray-500'}`}>{t('admin.ui.aiWebsite.featuresLabel')}</label>
                        <textarea
                          value={(v.features || []).join('\n')}
                          onChange={e => updateVersion(idx, { features: e.target.value.split('\n').filter(Boolean) })}
                          rows={3}
                          className={`${inputCls(!!v.highlight)} font-mono`}
                          placeholder={t('admin.ui.aiWebsite.featuresPlaceholder')}
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={v.ctaLabel || ''}
                          onChange={e => updateVersion(idx, { ctaLabel: e.target.value })}
                          className={inputCls(!!v.highlight)}
                          placeholder={t('admin.ui.aiWebsite.ctaLabelPlaceholder')}
                        />
                        <input
                          value={v.ctaUrl || ''}
                          onChange={e => updateVersion(idx, { ctaUrl: e.target.value })}
                          className={inputCls(!!v.highlight)}
                          placeholder={t('admin.ui.aiWebsite.ctaUrlPlaceholder')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addVersion}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm">{t('admin.ui.aiWebsite.addVersion')}</span>
                </button>
              </div>
              {(versions || []).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">{t('admin.ui.aiWebsite.noVersions')}</div>
              )}
            </div>
          </div>

          {/* 对比表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('admin.ui.aiWebsite.compareTitle')}</h2>
              <div className="flex items-center gap-2">
                <input
                  value={config.comparisonTitle || ''}
                  onChange={e => setConfig({ ...config, comparisonTitle: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
                  placeholder={t('admin.ui.aiWebsite.compareTitlePlaceholder')}
                />
                <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  <Plus className="w-3.5 h-3.5" /> {t('admin.ui.aiWebsite.addCompare')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 w-48">{t('admin.ui.aiWebsite.compareColFeature')}</th>
                    {(versions || []).map(v => (
                      <th key={v.key} className="py-2 px-3 text-center text-xs font-medium text-gray-700 min-w-[100px]">{v.name}</th>
                    ))}
                    <th className="py-2 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {(rows || []).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <input
                          value={row.feature}
                          onChange={e => updateRowFeature(idx, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      {(versions || []).map(v => (
                        <td key={v.key} className="py-2 px-3 text-center">
                          <input
                            value={row.values?.[v.key] ?? '—'}
                            onChange={e => updateRow(idx, row.feature, v.key, e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => removeRow(idx)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(rows || []).length === 0 && (
                    <tr><td colSpan={(versions?.length || 0) + 2} className="py-8 text-center text-gray-400 text-sm">{t('admin.ui.aiWebsite.noRows')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">{t('admin.ui.aiWebsite.compareNote')}</p>
          </div>
        </div>
      )}
    </div>
  );
}