'use client';

import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { validateImageFile, type ImageUploadRules } from '@/lib/uploadRules';

interface MultiImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  uploadType?: string;
  subPath?: string;
  rules?: ImageUploadRules;
}

export default function MultiImageUploader({ images, onChange, uploadType = 'temp', subPath, rules }: MultiImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', uploadType);
    if (subPath) form.append('subPath', subPath);
    if (rules) form.append('validate', rules.exactSize?.height === 1080 ? 'cover' : 'image');
      const res: any = await api.post('/upload', form);
    return res.data?.url || res.url;
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (rules) {
          const err = await validateImageFile(file, rules);
          if (err) {
            setError(`${file.name}：${err}`);
            return;
          }
        }
        const url = await uploadFile(file);
        urls.push(url);
      }
      onChange([...images, ...urls]);
    } catch (err) {
      console.error('Batch upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {images.map((url, i) => (
          <div key={i} className="relative group">
            <img src={getImageUrl(url)} alt="" className="h-20 w-32 object-cover rounded-md border border-gray-200" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
              <button type="button" onClick={() => removeImage(i)} className="p-1.5 bg-white rounded-full text-gray-700 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 h-20 w-32 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-4 h-4" /><span>批量上传</span></>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
