'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { trackPageDuration } from '@/lib/track';
import { generateVisitorId } from '@/lib/utils';

const LEAD_TRIGGER_KEY = 'sn_lead_triggered';
const PAGE_VIEW_KEY = 'sn_page_views';
const PAGE_HISTORY_KEY = 'sn_page_history';

const TOP_PAGE_TYPES: Record<string, string> = {
  products: 'product',
  solutions: 'solution',
  cases: 'case',
  articles: 'resource',
  resources: 'resource',
  'ai-facts': 'ai-facts',
  about: 'about',
  faqs: 'faq',
};

interface PageVisit {
  pageType: string;
  pageUrl: string;
  pageId?: number;
  title: string;
  timestamp: number;
}

interface UseTrackingOptions {
  /** Show lead capture modal callback */
  onShowLeadForm?: (source: string, interestArea?: string) => void;
  /** Auto trigger lead form after N page views */
  autoTriggerAfterViews?: number;
  /** Page types that are high-intent (trigger lead sooner) */
  highIntentPageTypes?: string[];
}

export function useTracking(options: UseTrackingOptions = {}) {
  const {
    onShowLeadForm,
    autoTriggerAfterViews = 3,
    highIntentPageTypes = ['product', 'solution', 'case', 'resource', 'ai-facts'],
  } = options;

  const [visitorId, setVisitorId] = useState<string>('');
  const [pageViews, setPageViews] = useState<number>(0);
  const [pageHistory, setPageHistory] = useState<PageVisit[]>([]);
  const lastUrlRef = useRef('');
  const enterRef = useRef<{ key: string; time: number } | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  // Initialize visitor ID (only on mount)
  useEffect(() => {
    let vid = localStorage.getItem('visitorId');
    if (!vid) {
      vid = generateVisitorId();
      localStorage.setItem('visitorId', vid);
    }
    setVisitorId(vid);

    const storedViews = parseInt(localStorage.getItem(PAGE_VIEW_KEY) || '0', 10);
    setPageViews(storedViews);

    const storedHistory = JSON.parse(localStorage.getItem(PAGE_HISTORY_KEY) || '[]');
    setPageHistory(storedHistory);
  }, []);

  // Track page view on mount/route change (pathname or query change)
  useEffect(() => {
    if (!visitorId) return;

    const params = new URLSearchParams(search);
    const effectiveUrl = search ? `${pathname}?${search}` : pathname;
    const pageType = inferPageType(pathname, params);

    let pageSlug: string | undefined = params.get('slug') || undefined;
    if (!pageSlug) {
      if (pathname.startsWith('/list/')) {
        const parts = pathname.split('/').filter(Boolean);
        const detailIdx = parts.indexOf('detail');
        if (detailIdx !== -1 && parts[detailIdx + 1]) {
          pageSlug = parts[detailIdx + 1];
        }
      } else {
        const match = pathname.match(/\/(?:products|solutions|cases|articles|resources)\/(.+)/);
        pageSlug = match ? match[1] : undefined;
      }
    }

    if (effectiveUrl === lastUrlRef.current) return;
    lastUrlRef.current = effectiveUrl;

    // 记录上一页停留时长，再开始计时当前页
    const prev = enterRef.current;
    if (prev && prev.key !== effectiveUrl) {
      trackPageDuration(visitorId, prev.key, Math.round((Date.now() - prev.time) / 1000));
    }
    enterRef.current = { key: effectiveUrl, time: Date.now() };

    recordPageView(pageType, effectiveUrl, pageSlug);

    const newCount = pageViews + 1;
    setPageViews(newCount);
    localStorage.setItem(PAGE_VIEW_KEY, String(newCount));

    const visit: PageVisit = {
      pageType,
      pageUrl: effectiveUrl,
      title: document.title,
      timestamp: Date.now(),
    };
    const newHistory = [...pageHistory, visit].slice(-20);
    setPageHistory(newHistory);
    localStorage.setItem(PAGE_HISTORY_KEY, JSON.stringify(newHistory));

    checkAutoTrigger(pageType, newCount, newHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, pathname, search]);

  // 页面隐藏/离开时上报当前页停留时长
  useEffect(() => {
    if (!visitorId) return;
    const flush = () => {
      const cur = enterRef.current;
      if (!cur) return;
      const secs = Math.round((Date.now() - cur.time) / 1000);
      if (secs > 0) trackPageDuration(visitorId, cur.key, secs);
      enterRef.current = { key: cur.key, time: Date.now() };
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [visitorId]);

  const inferPageType = (path: string, params: URLSearchParams): string => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return 'home';
    if (parts[0] === 'list') {
      // 内容模块 key 动态（如 demo-product / products），直接作为 pageType，
      // 由后端按 core_modules(module_key, is_system=0) 判定是否内容页
      return params.get('moduleKey') || parts[1] || 'other';
    }
    return TOP_PAGE_TYPES[parts[0]] || 'other';
  };

  const recordPageView = useCallback(async (pageType: string, pageUrl: string, pageSlug?: string) => {
    try {
      await api.post('/stats/page-view', null, {
        params: {
          pageType,
          pageUrl,
          visitorId,
          userAgent: navigator.userAgent,
          referer: document.referrer || '',
        },
      });
    } catch {
      // silently fail
    }
  }, [visitorId]);

  const recordBehavior = useCallback(async (behaviorType: string, targetType?: string, targetId?: number, metadata?: string) => {
    try {
      await api.post('/stats/behavior', null, {
        params: {
          visitorId,
          behaviorType,
          targetType,
          targetId,
          metadata,
        },
      });
    } catch {
      // silently fail
    }
  }, [visitorId]);

  const createVisitorLead = useCallback(async (interestAreas: string) => {
    try {
      await api.post('/leads/from-visitor', null, {
        params: {
          visitorId,
          sourcePage: window.location.pathname,
          interestArea: interestAreas,
          metadata: JSON.stringify({ pageHistory: pageHistory.slice(-10) }),
        },
      });
    } catch {
      // silently fail
    }
  }, [visitorId, pageHistory]);

  const checkAutoTrigger = useCallback((pageType: string, viewCount: number, history: PageVisit[]) => {
    if (!onShowLeadForm) return;
    if (localStorage.getItem(LEAD_TRIGGER_KEY)) return;

    const isHighIntent = highIntentPageTypes.includes(pageType);
    const uniquePageTypes = new Set(history.map(h => h.pageType));
    const highIntentCount = history.filter(h => highIntentPageTypes.includes(h.pageType)).length;

    if (
      viewCount >= autoTriggerAfterViews ||
      highIntentCount >= 2 ||
      (isHighIntent && viewCount >= 2)
    ) {
      const interestAreas = [...uniquePageTypes]
        .filter(t => highIntentPageTypes.includes(t))
        .map(t => {
          const labels: Record<string, string> = {
            product: '产品', solution: '解决方案', case: '案例',
            resource: '资源', 'ai-facts': 'AI 事实',
          };
          return labels[t] || t;
        })
        .join('、');

      localStorage.setItem(LEAD_TRIGGER_KEY, '1');
      createVisitorLead(interestAreas);
      onShowLeadForm('page_click', interestAreas);
    }
  }, [onShowLeadForm, highIntentPageTypes, autoTriggerAfterViews, createVisitorLead]);

  const trackClick = useCallback((targetType: string, targetId?: number, metadata?: string) => {
    recordBehavior('click', targetType, targetId, metadata);
  }, [recordBehavior]);

  const trackCtaClick = useCallback((ctaName: string, targetUrl?: string) => {
    recordBehavior('cta_click', undefined, undefined, JSON.stringify({ cta: ctaName, url: targetUrl || window.location.pathname }));

    if (!localStorage.getItem(LEAD_TRIGGER_KEY) && onShowLeadForm) {
      localStorage.setItem(LEAD_TRIGGER_KEY, '1');
      onShowLeadForm('page_click', ctaName);
    }
  }, [recordBehavior, onShowLeadForm]);

  const trackDownload = useCallback((targetType: string, targetId?: number) => {
    recordBehavior('download', targetType, targetId);
  }, [recordBehavior]);

  const trackAiChat = useCallback(() => {
    recordBehavior('ai_chat');
  }, [recordBehavior]);

  const resetTrigger = useCallback(() => {
    localStorage.removeItem(LEAD_TRIGGER_KEY);
    localStorage.removeItem(PAGE_VIEW_KEY);
    setPageViews(0);
    setPageHistory([]);
    localStorage.removeItem(PAGE_HISTORY_KEY);
  }, []);

  const getVisitorId = useCallback(() => visitorId, [visitorId]);

  return {
    visitorId,
    pageViews,
    pageHistory,
    trackClick,
    trackCtaClick,
    trackDownload,
    trackAiChat,
    resetTrigger,
    getVisitorId,
    recordBehavior,
  };
}
