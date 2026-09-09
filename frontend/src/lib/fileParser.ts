import * as mammoth from 'mammoth';

export interface ParsedFileResult {
  textContent?: string;
  rawBase64?: string;
  error?: string;
}

const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'yaml', 'yml', 'log']);
const MAX_BACKEND_FALLBACK_BYTES = 600 * 1024;

export async function parseDocumentFile(file: File): Promise<ParsedFileResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (TEXT_EXTS.has(ext)) {
    try {
      return { textContent: await file.text() };
    } catch {
      return { error: '无法读取文件内容' };
    }
  }

  if (ext === 'docx') {
    try {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      const text = (result.value || '').replace(/\r\n/g, '\n').trim();
      if (text) return { textContent: text };
    } catch {
      // 前端解析失败，回退到后端解析
    }
  }

  if (ext === 'pdf') {
    try {
      const buf = await file.arrayBuffer();
      const text = await extractPdfText(buf);
      if (text) return { textContent: text };
    } catch {
      // 前端解析失败，回退到后端解析
    }
  }

  if (file.size > MAX_BACKEND_FALLBACK_BYTES) {
    return { error: '文件内容无法解析（文件过大），请使用知识库功能导入' };
  }

  try {
    return { rawBase64: await fileToBase64(file) };
  } catch {
    return { error: '无法读取文件内容' };
  }
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  const loadingTask = pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' });
  const doc = await loadingTask.promise;
  try {
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .map((item) => ('str' in item ? (item.str ?? '') : ''))
        .join(' ') + '\n';
    }
    return text.trim();
  } finally {
    await loadingTask.destroy();
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
