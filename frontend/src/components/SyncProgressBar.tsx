'use client';

import { SyncProgress } from '@/types';

export default function SyncProgressBar({ progress }: { progress: SyncProgress }) {
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
            {isError ? '同步出错' : isDone ? '同步完成' : '正在向量化...'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {progress.success} 成功{progress.fail ? `，${progress.fail} 失败` : ''}
          {!isDone && progress.total > 0 && `（${progress.current}/${progress.total}）`}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {progress.currentItem && (
        <p className="text-[10px] text-gray-400 mt-1.5 truncate">当前：{progress.currentItem}</p>
      )}
      {isError && progress.errorMessage && (
        <p className="text-[10px] text-red-500 mt-1">{progress.errorMessage}</p>
      )}
    </div>
  );
}