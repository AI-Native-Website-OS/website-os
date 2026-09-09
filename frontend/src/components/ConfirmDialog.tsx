'use client';
import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export function useConfirm() {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const confirm = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ message, title, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    dialog?.resolve(true);
    setDialog(null);
  }, [dialog]);

  const handleCancel = useCallback(() => {
    dialog?.resolve(false);
    setDialog(null);
  }, [dialog]);

  const ConfirmDialog = dialog ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{dialog.title || '确认操作'}</h3>
        <p className="text-sm text-gray-600 mb-6">{dialog.message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{dialog.cancelText || '取消'}</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{dialog.confirmText || '确定'}</button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
