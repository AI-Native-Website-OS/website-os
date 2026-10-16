'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText, AlertCircle, Download } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Markdown from '@/components/Markdown';
import { downloadFile } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface FilePreviewProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

type SheetData = { name: string; rows: string[][] };

const MAX_SHEET_ROWS = 2000;

function getExtension(fileUrl: string, fileName: string): string {
  const source = (fileName || fileUrl).toLowerCase().split('?')[0].split('#')[0];
  const idx = source.lastIndexOf('.');
  return idx >= 0 ? source.slice(idx) : '';
}

/**
 * pptx-preview 解析到 [Content_Types].xml 中声明、但压缩包里并不存在的部件时（部分工具生成的文档
 * 会留下这种悬空引用），会抛错并静默中断整份解析，导致预览为空。这里在预览前剔除悬空的 Override 引用。
 */
async function sanitizePptxPackage(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const contentTypes = zip.file('[Content_Types].xml');
    if (!contentTypes) return buffer;
    const xml = await contentTypes.async('string');
    const cleaned = xml.replace(/<Override\b[^>]*?\/>/g, (tag) => {
      const match = /PartName="([^"]+)"/.exec(tag);
      if (!match) return tag;
      return zip.file(match[1].replace(/^\//, '')) ? tag : '';
    });
    if (cleaned === xml) return buffer;
    zip.file('[Content_Types].xml', cleaned);
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    return buffer;
  }
}

export default function FilePreview({ fileUrl, fileName, onClose }: FilePreviewProps) {
  const { t } = useI18n();
  const ext = getExtension(fileUrl, fileName);
  const isPdf = ext === '.pdf';
  const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/.test(ext);
  const isTxt = ext === '.txt';
  const isMd = ext === '.md' || ext === '.markdown';
  const isDocx = ext === '.docx';
  const isSheet = /\.(xlsx|xls|csv)$/.test(ext);
  const isPptx = ext === '.pptx';
  const isUnsupported = !isPdf && !isImage && !isTxt && !isMd && !isDocx && !isSheet && !isPptx;

  const [textContent, setTextContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const pptxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUnsupported) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const run = async () => {
      try {
        if (isTxt || isMd) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('Failed to fetch');
          const text = await res.text();
          if (!cancelled) setTextContent(text);
        } else if (isDocx) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('Failed to fetch');
          const buffer = await res.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (!cancelled) setHtmlContent(result.value);
        } else if (isSheet) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('Failed to fetch');
          const workbook = ext === '.csv'
            ? XLSX.read(await res.text(), { type: 'string' })
            : XLSX.read(await res.arrayBuffer(), { type: 'array' });
          const parsed: SheetData[] = workbook.SheetNames.map((name) => {
            const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
              header: 1, raw: false, defval: '', blankrows: false,
            });
            return { name, rows: rows.slice(0, MAX_SHEET_ROWS) };
          });
          if (!cancelled) { setSheets(parsed); setActiveSheet(0); }
        } else if (isPptx) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('Failed to fetch');
          const raw = await res.arrayBuffer();
          const buffer = await sanitizePptxPackage(raw);
          const { init } = await import('pptx-preview');
          if (cancelled || !pptxRef.current) return;
          const width = pptxRef.current.clientWidth || 960;
          const previewer = init(pptxRef.current, { width, height: Math.round(width * 9 / 16) });
          await previewer.preview(buffer);
          if (previewer.slideCount === 0) throw new Error('empty pptx');
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [fileUrl, ext, isTxt, isMd, isDocx, isSheet, isPptx, isUnsupported]);

  const handleDownload = () => {
    downloadFile(fileUrl, fileName).catch(() => window.open(fileUrl, '_blank'));
  };

  const renderContent = () => {
    if (isPdf) {
      return <iframe src={fileUrl} className="w-full h-[75vh] rounded-lg" />;
    }
    if (isImage) {
      return <img src={fileUrl} alt={fileName} className="max-w-full max-h-[75vh] mx-auto object-contain" />;
    }
    if (isUnsupported) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-gray-400">
          <AlertCircle className="w-10 h-10" />
          <p>{t('publicComp.unsupportedPreview')}</p>
          <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors text-sm">
            <Download className="w-4 h-4" />{t('publicComp.downloadFile')}
          </button>
        </div>
      );
    }

    // PPTX 容器必须始终挂载：pptx-preview 在 fetch 完成后需要已经存在的 DOM 节点，
    // 若挂在 loading 分支之后会在 init 时拿到 null，导致内容为空。
    if (isPptx) {
      return (
        <div className="relative w-full min-h-[75vh]">
          <div ref={pptxRef} className="w-full overflow-auto rounded-lg bg-gray-50" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white/70">{t('publicComp.loading')}</div>
          )}
          {!loading && loadError && <ErrorState />}
        </div>
      );
    }

    const pending = renderLoadingOrError(loading, loadError, t);
    if (pending) return pending;

    if ((isTxt || isMd) && textContent !== null) {
      if (isMd) {
        return (
          <div className="w-full min-h-[75vh] rounded-lg bg-white p-8 overflow-auto prose prose-sm max-w-none">
            <Markdown content={textContent} />
          </div>
        );
      }
      return (
        <pre className="w-full h-[75vh] rounded-lg bg-gray-50 p-6 overflow-auto text-sm leading-relaxed whitespace-pre-wrap font-mono">
          {textContent}
        </pre>
      );
    }

    if (isDocx && htmlContent !== null) {
      return (
        <div className="w-full min-h-[75vh] rounded-lg bg-white p-8 overflow-auto prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      );
    }

    if (isSheet && sheets.length > 0) {
      const sheet = sheets[activeSheet];
      const [header, ...body] = sheet.rows;
      return (
        <div className="w-full">
          {sheets.length > 1 && (
            <div className="flex items-center gap-1 mb-3 flex-wrap">
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${i === activeSheet ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-auto max-h-[75vh] rounded-lg border border-gray-200">
            <table className="min-w-full text-sm border-collapse">
              {header && (
                <thead>
                  <tr>
                    {header.map((cell, ci) => (
                      <th key={ci} className="px-3 py-2 bg-gray-50 text-gray-700 font-semibold text-left border-b border-gray-200 whitespace-nowrap">{cell}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="odd:bg-white even:bg-gray-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-700 border-b border-gray-100 align-top">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
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
            <button onClick={handleDownload} className="p-1.5 text-gray-400 hover:text-black transition-colors" title={t('publicComp.download')}>
              <Download className="w-5 h-5" />
            </button>
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

function renderLoadingOrError(loading: boolean, loadError: boolean, t: (key: string) => string) {
  if (loading) return <div className="flex items-center justify-center h-[40vh] text-gray-400">{t('publicComp.loading')}</div>;
  if (loadError) return <ErrorState />;
  return null;
}

function ErrorState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-[40vh] text-gray-400 gap-3">
      <AlertCircle className="w-10 h-10" />
      <p>{t('publicComp.loadFailed')}</p>
    </div>
  );
}
