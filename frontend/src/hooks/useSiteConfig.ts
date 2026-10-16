'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { t } from '@/i18n/translate';

export interface SiteOpenLink {
  label: string;
  url: string;
  icon?: string;
  enabled?: boolean;
}

export interface SiteConfig {
  siteName?: string;
  siteFullName?: string;
  siteDescription?: string;
  copyright?: string;
  companyName?: string;
  contactPhone?: string;
  contactEmail?: string;
  icpNumber?: string;
  icpUrl?: string;
  url?: string;
  logo?: string;
  favicon?: string;
  githubUrl?: string;
  giteeUrl?: string;
  docsUrl?: string;
  pilotUrl?: string;
  githubIcon?: string;
  giteeIcon?: string;
  docsIcon?: string;
  pilotIcon?: string;
  openLinks?: SiteOpenLink[];
  versionEnabled?: boolean;
}

function defaultSiteConfig(): SiteConfig {
  return {
    siteName: t('libUi.site.siteName'),
    siteFullName: t('libUi.site.siteFullName'),
    siteDescription: '',
    copyright: t('libUi.site.copyright'),
    companyName: t('libUi.site.companyName'),
    contactPhone: '010-00000000',
    contactEmail: 'demo@example.com',
    icpNumber: t('libUi.site.icpNumber'),
    icpUrl: 'https://beian.miit.gov.cn/#/Integrated/recordQuery',
    url: '',
    logo: '/logo.png',
    favicon: '/logo-lable.png',
    githubUrl: '',
    giteeUrl: '',
    docsUrl: '',
    pilotUrl: '',
    githubIcon: 'github',
    giteeIcon: 'gitee',
    docsIcon: 'book',
    pilotIcon: 'rocket',
    versionEnabled: false,
    openLinks: [
      { label: 'GitHub', url: '', icon: 'github', enabled: true },
      { label: 'Gitee', url: '', icon: 'gitee', enabled: true },
      { label: 'Docs', url: '', icon: 'book', enabled: true },
      { label: 'Pilot', url: '', icon: 'rocket', enabled: true },
    ],
  };
}

let cache: SiteConfig | null = null;
let inflight: Promise<SiteConfig> | null = null;

function buildOpenLinksFromLegacy(cfg: SiteConfig): SiteOpenLink[] {
  return [
    { label: 'GitHub', url: cfg.githubUrl || '', icon: cfg.githubIcon || 'github', enabled: true },
    { label: 'Gitee', url: cfg.giteeUrl || '', icon: cfg.giteeIcon || 'gitee', enabled: true },
    { label: 'Docs', url: cfg.docsUrl || '', icon: cfg.docsIcon || 'book', enabled: true },
    { label: 'Pilot', url: cfg.pilotUrl || '', icon: cfg.pilotIcon || 'rocket', enabled: true },
  ];
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api
      .get('/home/site')
      .then((res: any) => {
        const data: SiteConfig = { ...defaultSiteConfig(), ...(res?.data || {}) };
        if (!data.openLinks && (data.githubUrl || data.giteeUrl || data.docsUrl || data.pilotUrl)) {
          data.openLinks = buildOpenLinksFromLegacy(data);
        }
        cache = data;
        return data;
      })
      .catch(() => {
        cache = defaultSiteConfig();
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useSiteConfig(): { siteConfig: SiteConfig; loading: boolean } {
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetchSiteConfig().then((cfg) => {
        if (mounted) {
          setSiteConfig(cfg);
          setLoading(false);
        }
      });
    };
    load();
    const handler = () => {
      cache = null;
      load();
    };
    window.addEventListener('site-config-changed', handler);
    return () => {
      mounted = false;
      window.removeEventListener('site-config-changed', handler);
    };
  }, []);

  return { siteConfig, loading };
}

export function getSiteConfig(): Promise<SiteConfig> {
  return fetchSiteConfig();
}
