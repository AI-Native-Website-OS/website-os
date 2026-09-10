'use client';

import { useEffect, useState } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';

interface FilePreviewProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function FilePreview({ fileUrl, fileName, onClose }: FilePreviewProps) {
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(fileUrl);
  const isText = /\.(txt|md)$/i.test(fileUrl);
  const isDocx = fileUrl.toLowerCase().endsWith('.docx');

  const [textContent, setTextContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isText) {
      setLoading(true);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.text();
        })
        .then(setTextContent)
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    } else if (isDocx) {
      setLoading(true);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.arrayBuffer();
        })
        .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
        .then((result) => setHtmlContent(result.value))
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    }
  }, [fileUrl, isText, isDocx]);

  const renderContent = () => {
    if (isPdf) {
      return <iframe src={fileUrl} className="w-full h-[75vh] rounded-lg" />;
    }
    if (isImage) {
      return <img src={fileUrl} alt={fileName} className="max-w-full max-h-[75vh] mx-auto object-contain" />;
    }
    if (isText) {
      const pending = renderLoadingOrError(loading, loadError);
      if (pending) return pending;
      if (textContent !== null) {
        return (
          <pre className="w-full h-[75vh] rounded-lg bg-gray-50 p-6 overflow-auto text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {textContent}
          </pre>
        );
      }
      return null;
    }
    if (isDocx) {
      const pending = renderLoadingOrError(loading, loadError);
      if (pending) return pending;
      if (htmlContent !== null) {
        return (
          <div className="w-full min-h-[75vh] rounded-lg bg-white p-8 overflow-auto prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        );
      }
      return null;
    }
    return <iframe src={fileUrl} className="w-full h-[75vh] rounded-lg" />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-gray-500 shrink-0" />
            <span className="font-medium text-gray-900 truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-4 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function renderLoadingOrError(loading: boolean, loadError: boolean) {
  if (loading) return <div className="flex items-center justify-center h-[40vh] text-gray-400">加载中...</div>;
  if (loadError) return <ErrorState />;
  return null;
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center h-[40vh] text-gray-400 gap-3">
      <AlertCircle className="w-10 h-10" />
      <p>文件加载失败</p>
    </div>
  );
}
