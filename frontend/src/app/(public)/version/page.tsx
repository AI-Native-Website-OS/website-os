'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import { useI18n } from '@/i18n/I18nProvider';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { Check, Minus, Sparkles, ArrowRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { AiWebsiteConfig, AiWebsiteVersionItem } from '@/types';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function buildDefaultConfig(t: TranslateFn): AiWebsiteConfig {
  return {
    title: t('publicPages.version.defaultTitle'),
    subtitle: t('publicPages.version.defaultSubtitle'),
    comparisonTitle: t('publicPages.version.comparisonTitle'),
    versions: [
      {
        key: 'basic', name: t('publicPages.version.basicName'), tagline: t('publicPages.version.basicTagline'), price: '¥0', priceNote: t('publicPages.version.basicPriceNote'),
        description: t('publicPages.version.basicDescription'),
        features: [
          t('publicPages.version.basicFeature1'),
          t('publicPages.version.basicFeature2'),
          t('publicPages.version.basicFeature3'),
          t('publicPages.version.basicFeature4'),
        ],
        highlight: false, ctaLabel: t('publicPages.version.basicCta'), ctaUrl: '/#chat',
      },
      {
        key: 'pro', name: t('publicPages.version.proName'), tagline: t('publicPages.version.proTagline'), price: '¥399', priceNote: t('publicPages.version.proPriceNote'),
        description: t('publicPages.version.proDescription'),
        features: [
          t('publicPages.version.proFeature1'),
          t('publicPages.version.proFeature2'),
          t('publicPages.version.proFeature3'),
          t('publicPages.version.proFeature4'),
          t('publicPages.version.proFeature5'),
          t('publicPages.version.proFeature6'),
        ],
        highlight: true, ctaLabel: t('publicPages.version.proCta'), ctaUrl: '/#chat',
      },
      {
        key: 'enterprise', name: t('publicPages.version.enterpriseName'), tagline: t('publicPages.version.enterpriseTagline'), price: t('publicPages.version.enterprisePrice'), priceNote: t('publicPages.version.enterprisePriceNote'),
        description: t('publicPages.version.enterpriseDescription'),
        features: [
          t('publicPages.version.enterpriseFeature1'),
          t('publicPages.version.enterpriseFeature2'),
          t('publicPages.version.enterpriseFeature3'),
          t('publicPages.version.enterpriseFeature4'),
          t('publicPages.version.enterpriseFeature5'),
        ],
        highlight: false, ctaLabel: t('publicPages.version.enterpriseCta'), ctaUrl: '/about#contact',
      },
    ],
    comparisonRows: [
      { feature: t('publicPages.version.rowContentManagement'), values: { basic: '✓', pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowAiAssistant'), values: { basic: t('publicPages.version.valLimitedDaily'), pro: t('publicPages.version.valUnlimited'), enterprise: t('publicPages.version.valUnlimited') } },
      { feature: t('publicPages.version.rowKbRag'), values: { basic: '—', pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowLongTermMemory'), values: { basic: '—', pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowBehaviorTracking'), values: { basic: t('publicPages.version.valBasic'), pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowBilingual'), values: { basic: '✓', pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowSeoGeo'), values: { basic: '—', pro: '✓', enterprise: '✓' } },
      { feature: t('publicPages.version.rowPrivateDeploy'), values: { basic: '—', pro: '—', enterprise: '✓' } },
      { feature: t('publicPages.version.rowCustomModel'), values: { basic: '—', pro: '—', enterprise: '✓' } },
      { feature: t('publicPages.version.rowSupport'), values: { basic: t('publicPages.version.valCommunity'), pro: t('publicPages.version.valPriority'), enterprise: t('publicPages.version.valDedicated') } },
    ],
  };
}

function renderValue(value: string) {
  if (value === '✓') return <Check className="w-4 h-4 text-green-600 mx-auto" />;
  if (value === '—' || value === '-' || value === '×') return <Minus className="w-4 h-4 text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700">{value}</span>;
}

export default function VersionPage() {
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();
  const defaultConfig = useMemo(() => buildDefaultConfig(t), [t]);
  const [config, setConfig] = useState<AiWebsiteConfig>(() => defaultConfig);
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

  const versions = config.versions || defaultConfig.versions || [];
  const rows = config.comparisonRows || defaultConfig.comparisonRows || [];

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
        title={config.title || t('publicPages.version.fallbackTitle')}
        description={t('publicPages.version.seoDescription')}
        path="/version"
        breadcrumbs={[
          { name: t('common.home'), url: '/' },
          { name: config.title || t('publicPages.version.fallbackTitle'), url: '/version' },
        ]}
      />
      <div className="bg-white min-h-screen">
        <section className="pt-28 pb-12 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb items={[
              { name: t('common.home'), url: '/' },
              { name: config.title || t('publicPages.version.fallbackTitle'), url: '/version' },
            ]} />
            <h1 className="text-4xl md:text-5xl font-bold mt-8 mb-4">{config.title || t('publicPages.version.fallbackTitle')}</h1>
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
                      <Sparkles className="w-3 h-3" /> {t('publicPages.version.recommended')}
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
                    {v.ctaLabel || t('publicPages.version.learnMore')} <ArrowRight className="w-4 h-4" />
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
              <h2 className="text-2xl font-bold text-center mb-8">{config.comparisonTitle || t('publicPages.version.comparisonTitle')}</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-4 px-4 text-left font-medium text-gray-500 w-1/4">{t('publicPages.version.featureLabel')}</th>
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