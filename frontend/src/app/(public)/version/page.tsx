'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import { useI18n } from '@/i18n/I18nProvider';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { Check, Minus, Sparkles, ArrowRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { AiWebsiteConfig, AiWebsiteVersionItem } from '@/types';

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

function renderValue(value: string) {
  if (value === '✓') return <Check className="w-4 h-4 text-green-600 mx-auto" />;
  if (value === '—' || value === '-' || value === '×') return <Minus className="w-4 h-4 text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700">{value}</span>;
}

export default function VersionPage() {
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();
  const [config, setConfig] = useState<AiWebsiteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/page-config/ai-website')
      .then((res: any) => {
        const data = res?.data;
        if (data && (data.title || data.subtitle || data.comparisonTitle || data.versions?.length || data.comparisonRows?.length)) {
          setConfig(prev => ({
            title: data.title || prev.title,
            subtitle: data.subtitle || prev.subtitle,
            comparisonTitle: data.comparisonTitle || prev.comparisonTitle,
            versions: data.versions?.length ? data.versions : prev.versions,
            comparisonRows: data.comparisonRows?.length ? data.comparisonRows : prev.comparisonRows,
          }));
        }
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const versions = config.versions || DEFAULT_CONFIG.versions || [];
  const rows = config.comparisonRows || DEFAULT_CONFIG.comparisonRows || [];

  if (siteConfig.versionEnabled === false) {
    return (
      <>
        <SeoHead title={t('admin.versionDisabledPage')} path="/version" />
        <div className="bg-white min-h-screen flex flex-col items-center justify-center px-4 py-40">
          <XCircle className="w-14 h-14 text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('admin.versionDisabledPage')}</h1>
          <p className="text-gray-500 mb-6">{t('admin.versionDisabledPageDesc')}</p>
          <Link href="/" className="px-5 py-2.5 rounded-full text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors">
            {t('common.backHome')}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead
        title={config.title || '版本介绍'}
        description="AI 企业官网不同版本（基础版 / 专业版 / 旗舰版）的介绍与功能对比，选择适合您企业的版本。"
        path="/version"
        breadcrumbs={[
          { name: t('common.home'), url: '/' },
          { name: config.title || '版本介绍', url: '/version' },
        ]}
      />
      <div className="bg-white min-h-screen">
        <section className="pt-28 pb-12 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb items={[
              { name: t('common.home'), url: '/' },
              { name: config.title || '版本介绍', url: '/version' },
            ]} />
            <h1 className="text-4xl md:text-5xl font-bold mt-8 mb-4">{config.title || '版本介绍'}</h1>
            <p className="text-lg text-gray-500 max-w-2xl">{config.subtitle}</p>
          </div>
        </section>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          </div>
        )}

        <section className="py-12">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-6"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, versions.length)}, minmax(320px, 1fr))` }}
              >
              {versions.map((v: AiWebsiteVersionItem) => (
                <div
                  key={v.key}
                  className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                    v.highlight
                      ? 'border-black shadow-2xl bg-gradient-to-b from-black to-gray-900 text-white md:-mt-4 md:mb-4'
                      : 'border-gray-200 hover:shadow-lg'
                  }`}
                >
                  {v.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white text-black text-xs font-bold px-3 py-1 rounded-full border border-black shadow">
                      <Sparkles className="w-3 h-3" /> 推荐
                    </div>
                  )}
                  <h3 className={`text-xl font-bold ${v.highlight ? 'text-white' : 'text-gray-900'}`}>{v.name}</h3>
                  <p className={`text-sm mt-1 ${v.highlight ? 'text-gray-300' : 'text-gray-500'}`}>{v.tagline}</p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={`text-3xl font-extrabold ${v.highlight ? 'text-white' : 'text-gray-900'}`}>{v.price}</span>
                    <span className={`text-sm ${v.highlight ? 'text-gray-400' : 'text-gray-400'}`}>{v.priceNote}</span>
                  </div>
                  <p className={`mt-4 text-sm leading-relaxed ${v.highlight ? 'text-gray-200' : 'text-gray-600'}`}>{v.description}</p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {(v.features || []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${v.highlight ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={v.highlight ? 'text-gray-100' : 'text-gray-700'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={v.ctaUrl || '/#chat'}
                    className={`mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                      v.highlight
                        ? 'bg-white text-black hover:bg-gray-100'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    {v.ctaLabel || '了解更多'} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
              </div>
            </div>
          </div>
        </section>

        {rows.length > 0 && (
          <section className="py-12">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-center mb-8">{config.comparisonTitle || '功能对比'}</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-4 px-4 text-left font-medium text-gray-500 w-1/4">功能</th>
                      {versions.map((v) => (
                        <th key={v.key} className={`py-4 px-4 text-center font-semibold ${v.highlight ? 'text-black' : 'text-gray-900'}`}>
                          {v.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <td className="py-3.5 px-4 text-gray-700 font-medium">{row.feature}</td>
                        {versions.map((v) => (
                          <td key={v.key} className="py-3.5 px-4 text-center">
                            {renderValue(row.values?.[v.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}