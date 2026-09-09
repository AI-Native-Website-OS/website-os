'use client';

import { useRef, useState, useEffect } from 'react';
import { Upload, X, ImageIcon, Clock } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import { validateImageFile, type ImageUploadRules } from '@/lib/uploadRules';
import api from '@/lib/api';

interface ImageUploaderProps {
  value?: string;
  file?: File | null;
  onFileSelect?: (file: File | null) => void;
  onChange?: (url: string) => void;
  autoUpload?: boolean;
  uploadType?: string;
  subPath?: string;
  size?: 'md' | 'sm';
  objectFit?: 'cover' | 'contain';
  rules?: ImageUploadRules;
}

export default function ImageUploader({ value, file, onFileSelect, onChange, autoUpload, uploadType, subPath, size = 'md', objectFit = 'cover', rules }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  const dim = size === 'sm' ? 'h-16 w-28' : 'h-24 w-40';
  const fit = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl('');
  }, [file]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    if (rules) {
      const err = await validateImageFile(f, rules);
      if (err) {
        setError(err);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }
    if (autoUpload && uploadType) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', f);
        form.append('type', uploadType);
        if (subPath) form.append('subPath', subPath);
        if (rules) form.append('validate', rules.exactSize?.height === 1080 ? 'cover' : 'image');
        const res: any = await api.post('/upload', form);
        if (res.code === 200) {
          onChange?.(res.data?.url || res.url);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploading(false);
      }
    } else {
      onFileSelect?.(f);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    if (file) {
      onFileSelect?.(null);
    } else {
      onChange?.('');
    }
    setPreviewUrl('');
    setError('');
  };

  const displaySrc = previewUrl || (value ? getImageUrl(value) : '');

  return (
    <div>
      {displaySrc ? (
        <div className="relative group inline-block">
          <img src={displaySrc} alt="封面预览" className={`${dim} ${fit} rounded-md border border-gray-200`} />
          {file && (
            <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
              <Clock className="w-3 h-3" />待上传
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="p-1 bg-white rounded-full text-gray-700 hover:text-black">
              <Upload className="w-4 h-4" />
            </button>
            <button type="button" onClick={handleRemove} className="p-1 bg-white rounded-full text-gray-700 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex items-center justify-center gap-2 ${dim} border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors`}
        >
          <ImageIcon className="w-5 h-5" /><span>上传封面</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
