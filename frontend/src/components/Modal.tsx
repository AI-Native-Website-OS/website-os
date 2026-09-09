'use client';

import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  width?: string;
}

export default function Modal({ open, onClose, title, children, className = '', width = 'w-[820px]' }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-black/40 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl ${width} max-h-[90vh] flex flex-col ${className}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
