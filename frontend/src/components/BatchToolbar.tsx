'use client';

import { Trash2, CheckCircle, XCircle } from 'lucide-react';

interface BatchToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  loading?: boolean;
}

export default function BatchToolbar({ selectedCount, onDelete, onPublish, onUnpublish, loading }: BatchToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <span className="text-sm text-blue-700 font-medium">已选择 {selectedCount} 项</span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onPublish}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" /> 发布
        </button>
        <button
          onClick={onUnpublish}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 disabled:opacity-50 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" /> 下架
        </button>
        <button
          onClick={onDelete}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> 删除
        </button>
      </div>
    </div>
  );
}
