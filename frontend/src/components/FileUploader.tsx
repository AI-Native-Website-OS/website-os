'use client';

import { useRef, useState } from 'react';
import { Upload, X, FileText, Clock } from 'lucide-react';
import config from '@/config';
import { validateDocumentFile, DEFAULT_DOCUMENT_RULES, type DocumentUploadRules } from '@/lib/uploadRules';

interface FileUploaderProps {
  filePath?: string;
  fileName?: string;
  file?: File | null;
  onFileSelect?: (file: File | null) => void;
  onRemove?: () => void;
  accept?: string;
  rules?: DocumentUploadRules;
}

function getFilePreviewUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : '/uploads/' + path;
  const base = config.upload.baseUrl.replace(/\/+$/, '');
  return base ? `${base}${normalized}` : normalized;
}

export default function FileUploader({ filePath, fileName, file, onFileSelect, onRemove, accept = '.pdf,.doc,.docx', rules = DEFAULT_DOCUMENT_RULES }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    if (rules) {
      const err = validateDocumentFile(f, rules);
      if (err) {
        setError(err);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }
    setPendingFile(f);
    onFileSelect?.(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    if (pendingFile) {
      setPendingFile(null);
      onFileSelect?.(null);
    } else {
      onRemove?.();
    }
    setError('');
  };

  const effectiveFile = file ?? pendingFile;
  const showName = effectiveFile?.name || fileName || filePath?.split('/').pop() || '';
  const isPending = !!effectiveFile;

  return (
    <div>
      {filePath || pendingFile ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
          <button type="button" onClick={() => inputRef.current?.click()} className="p-0.5 text-gray-400 hover:text-black flex-shrink-0" title="替换文件">
            <Upload className="w-4 h-4" />
          </button>
          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="flex-1 truncate text-gray-700">{showName}</span>
          {isPending && (
            <span className="flex items-center gap-1 text-xs text-amber-600 flex-shrink-0">
              <Clock className="w-3 h-3" />待上传
            </span>
          )}
          {!isPending && filePath && (
            <a href={getFilePreviewUrl(filePath)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-shrink-0">预览</a>
          )}
          <button onClick={handleRemove} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          选择文件
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
