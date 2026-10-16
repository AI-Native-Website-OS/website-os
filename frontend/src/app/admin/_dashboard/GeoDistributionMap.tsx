'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';
import { normalizeProvince, normalizeCountry } from './geoNameMap';

type Source = 'all' | 'visit' | 'lead';
type Scope = 'china' | 'world';

const SOURCES: { key: Source; label: string }[] = [
  { key: 'all', label: 'admin.ui.dashboard.geoTabAll' },
  { key: 'visit', label: 'admin.ui.dashboard.geoTabVisit' },
  { key: 'lead', label: 'admin.ui.dashboard.geoTabLead' },
];

const SOURCE_TAG: Record<Source, string> = {
  all: 'admin.ui.dashboard.geoSourceAll',
  visit: 'admin.ui.dashboard.geoTabVisit',
  lead: 'admin.ui.dashboard.geoTabLead',
};

export default function GeoDistributionMap() {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>('china');
  const [source, setSource] = useState<Source>('all');
  const [items, setItems] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const registeredRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.stats.geoDistribution({ scope, source })
      .then(res => { if (!cancelled) setItems(res.data || []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, source]);

  useEffect(() => {
    let disposed = false;
    let onResize: (() => void) | undefined;
    (async () => {
      try {
        const echarts: any = await import('echarts/core');
        const { MapChart } = await import('echarts/charts');
        const { TooltipComponent, VisualMapComponent } = await import('echarts/components');
        const { CanvasRenderer } = await import('echarts/renderers');
        echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);
        if (disposed || !containerRef.current) return;
        echartsRef.current = echarts;
        chartRef.current = echarts.init(containerRef.current);
        onResize = () => chartRef.current?.resize();
        window.addEventListener('resize', onResize);
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      if (onResize) window.removeEventListener('resize', onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const echarts = echartsRef.current;
    const chart = chartRef.current;
    if (!echarts || !chart) return;

    let cancelled = false;
    (async () => {
      try {
        if (!registeredRef.current[scope]) {
          const geo = await (await fetch(`/geo/${scope}.json`)).json();
          echarts.registerMap(scope, geo);
          registeredRef.current[scope] = true;
        }
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled) return;

      const normalize = scope === 'china' ? normalizeProvince : normalizeCountry;
      const data = items.map(d => ({ name: normalize(d.name), value: d.value }));
      const max = Math.max(...data.map(d => d.value), 1);
      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => `${p.name}<br/>${t('admin.ui.dashboard.geoVisits')}：${(p.value ?? 0).toLocaleString()}`,
        },
        visualMap: {
          min: 0,
          max,
          left: 12,
          bottom: 12,
          calculable: true,
          text: [t('admin.ui.dashboard.geoHigh'), t('admin.ui.dashboard.geoLow')],
          textStyle: { fontSize: 11, color: '#737373' },
          inRange: { color: ['#f3f4f6', '#93c5fd', '#2563eb'] },
        },
        series: [{
          type: 'map',
          map: scope,
          roam: false,
          zoom: 1.15,
          label: { show: false },
          emphasis: { label: { show: false }, itemStyle: { areaColor: '#bfdbfe' } },
          itemStyle: { borderColor: '#e5e7eb', borderWidth: 0.5, areaColor: '#f9fafb' },
          data,
        }],
      }, true);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scope, items]);

  const showOverlay = !ready || failed || loading;
  const overlayText = failed ? t('admin.ui.dashboard.geoEmpty') : t('common.loading');

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md text-gray-400"><MapPin className="w-4 h-4" /></div>
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.ui.dashboard.geoTitle')}</h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {t('admin.ui.dashboard.geoSourcePrefix')}{t(SOURCE_TAG[source])}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {SOURCES.map(s => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150',
                  source === s.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                )}
              >
                {t(s.label)}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1">
            {(['china', 'world'] as Scope[]).map(k => (
              <button
                key={k}
                onClick={() => setScope(k)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150',
                  scope === k ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
                )}
              >
                {t(k === 'china' ? 'admin.ui.dashboard.geoScopeChina' : 'admin.ui.dashboard.geoScopeWorld')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full h-[560px]" />
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <p className="text-gray-300 text-sm">{overlayText}</p>
          </div>
        )}
        {!showOverlay && items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">{t('admin.ui.dashboard.geoEmpty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
