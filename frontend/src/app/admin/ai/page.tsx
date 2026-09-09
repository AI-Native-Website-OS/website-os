'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { aiService } from '@/lib/aiService';
import { adminApi } from '@/lib/adminApi';
import { Settings, Bot, Cpu, Database, MessageSquare, Activity, Globe, Check, AlertCircle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { ConfigOut, RagConfigOut } from '@/types';

export default function AdminAi() {
  const { t } = useI18n();
  const [config, setConfig] = useState<ConfigOut | null>(null);
  const [stats, setStats] = useState<{ prompt: number; completion: number; total: number } | null>(null);
  const [ragConfig, setRagConfig] = useState<RagConfigOut | null>(null);
  const [tokenLogs, setTokenLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      aiService.config.get(),
      aiService.stats.get(),
      aiService.stats.tokenLogs(),
      aiService.ragConfig.get().catch(() => null),
    ]).then(([cfg, st, logs, rag]) => {
      setConfig(cfg as any);
      setStats(st as any);
      setTokenLogs(logs as any);
      setRagConfig(rag as any);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res: any = await adminApi.knowledge.syncAll();
      const data = res?.data || res;
      if (data) {
        setSyncResult({ type: 'success', text: t('admin.ui.ai.syncDoneMsg').replace('{success}', String(data.success)).replace('{fail}', String(data.fail)) });
      } else {
        setSyncResult({ type: 'success', text: t('admin.ui.ai.syncDone') });
      }
    } catch (e: any) {
      setSyncResult({ type: 'error', text: t('admin.ui.ai.syncFail').replace('{msg}', e?.message || '') });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.ai.title')}</h1>

      {/* Knowledge Sync Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <h3 className="font-semibold text-gray-900">{t('admin.ui.ai.kbSync')}</h3>
          </div>
          {ragConfig && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${ragConfig.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {ragConfig.enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {t('admin.ui.ai.ragStatus').replace('{status}', ragConfig.enabled ? t('common.on') : t('common.off'))}
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-500 mb-4">
            {t('admin.ui.ai.kbSyncDesc')}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {syncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {syncing ? t('common.syncing') : t('admin.ui.ai.syncToKb')}
            </button>
            {syncResult && (
              <div className={`flex items-center gap-2 text-sm ${syncResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {syncResult.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {syncResult.text}
              </div>
            )}
          </div>
          {ragConfig && !ragConfig.enabled && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {t('admin.ui.ai.ragOffPrefix')} <Link href="/admin/ai/knowledge" className="underline font-medium">{t('admin.ui.ai.ragOffLink')}</Link> {t('admin.ui.ai.ragOffSuffix')}
            </div>
          )}
        </div>
      </div>

      {/* Config Overview */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
              <div><h3 className="text-sm font-semibold text-black">{t('admin.ui.ai.modelCard')}</h3><p className="text-xs text-gray-400">{t('admin.ui.ai.providerModel')}</p></div>
            </div>
            <p className="text-sm text-gray-600">{config.llm_provider || '-'} / {config.llm_model || '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center"><Cpu className="w-5 h-5 text-white" /></div>
              <div><h3 className="text-sm font-semibold text-black">{t('admin.ui.ai.paramCard')}</h3><p className="text-xs text-gray-400">{t('admin.ui.ai.tempMax')}</p></div>
            </div>
            <p className="text-sm text-gray-600">Temperature: {config.llm_temperature} | Max: {config.llm_max_tokens}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
              <div><h3 className="text-sm font-semibold text-black">{t('admin.ui.ai.tokenCard')}</h3><p className="text-xs text-gray-400">{t('admin.ui.ai.totalUsage')}</p></div>
            </div>
            <p className="text-sm text-gray-600">{t('admin.ui.ai.totalTokens').replace('{n}', (stats?.total || 0).toLocaleString())}</p>
          </div>
        </div>
      )}

      {/* Config Details */}
      {config && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <h3 className="font-semibold text-gray-900">{t('admin.ui.ai.configTitle')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: 'Provider', value: config.llm_provider || '-' },
              { label: 'Base URL', value: config.llm_base_url || '-' },
              { label: 'Model', value: config.llm_model || '-' },
              { label: 'Temperature', value: config.llm_temperature },
              { label: 'Max Tokens', value: config.llm_max_tokens },
              { label: 'Top P', value: config.llm_top_p },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-medium text-gray-900">{String(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Token Logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Database className="w-4 h-4" />
          <h3 className="font-semibold text-gray-900">{t('admin.ui.ai.tokenLogsTitle')}</h3>
        </div>
        {tokenLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">{t('admin.ui.ai.noTokenLogs')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="text-left py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colTime')}</th><th className="text-left py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colModel')}</th><th className="text-right py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colPrompt')}</th><th className="text-right py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colCompletion')}</th><th className="text-right py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colTotal')}</th><th className="text-right py-2.5 px-4 font-medium text-gray-500">{t('admin.ui.ai.colCost')}</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {tokenLogs.slice(0, 10).map((log, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-4 text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 px-4">{log.model}</td>
                    <td className="py-2.5 px-4 text-right">{log.prompt_tokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right">{log.completion_tokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right">{log.total_tokens?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right">{log.cost_usd?.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
