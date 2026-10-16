'use client';

import { SyncProgress } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';

export default function SyncProgressBar({ progress }: { progress: SyncProgress }) {
  const { t } = useI18n();
  const isError = progress.status === 'error';
  const isDone = progress.status === 'completed' || progress.status === 'error';
  const pct = progress.percent || 0;
  const barColor = isError ? 'bg-red-500' : pct === 100 ? 'bg-green-500' : 'bg-black';

  return (
    <div className="w-full bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {!isDone && <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
          <span className="text-xs font-medium text-gray-700">
            {isError ? t('adminComp.sync.statusError') : isDone ? t('adminComp.sync.statusDone') : t('adminComp.sync.statusRunning')}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {t('adminComp.sync.success', { success: progress.success })}{progress.fail ? t('adminComp.sync.fail', { fail: progress.fail }) : ''}
          {!isDone && progress.total > 0 && t('adminComp.sync.progress', { current: progress.current, total: progress.total })}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {progress.currentItem && (
        <p className="text-[10px] text-gray-400 mt-1.5 truncate">{t('adminComp.sync.currentPrefix')}{progress.currentItem}</p>
      )}
      {isError && progress.errorMessage && (
        <p className="text-[10px] text-red-500 mt-1">{progress.errorMessage}</p>
      )}
    </div>
  );
}