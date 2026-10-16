// 内容管理上传规则（图片/文档）
// 仅当组件传入 rules 时才启用校验；Logo、公安图标等不传规则即不受影响。

import { t, tList } from '@/i18n/translate';

export interface ImageUploadRules {
  maxSizeMB: number;
  allowedExtensions: string[];
  forbiddenExtensions: string[];
  maxNameLength: number;
  forbiddenNameChars: RegExp;
  exactSize?: { width: number; height: number };
}

export interface DocumentUploadRules {
  maxSizeMB: number;
  allowedExtensions: string[];
  forbiddenExtensions: string[];
  maxNameLength: number;
  forbiddenNameChars: RegExp;
}

// 封面图规则：核心模块/分类/详情页封面
export const COVER_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  forbiddenExtensions: ['svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
  exactSize: { width: 1920, height: 1080 },
};

// 区块图片规则：详情页正文图片、首页等非轮播区块图片
export const BLOCK_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  forbiddenExtensions: ['svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
  exactSize: { width: 1920, height: 800 },
};

// 浏览器标签页图标规则：favicon 仅支持浏览器可渲染的格式
// （WebP / SVG / GIF / ICO 不被浏览器作为 favicon 稳定支持，故禁止上传）
export const FAVICON_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 1,
  allowedExtensions: ['jpg', 'jpeg', 'png'],
  forbiddenExtensions: ['webp', 'svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// HTML 模板内嵌图片规则：不限制尺寸（尺寸由 HTML 排版决定），其余与区块图片一致
export const HTML_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  forbiddenExtensions: ['svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// 二维码图片规则：不限制尺寸，支持常见图片格式
export const QR_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  forbiddenExtensions: ['svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// 默认文档规则：内容管理中新增内容的关联文档
export const DEFAULT_DOCUMENT_RULES: DocumentUploadRules = {
  maxSizeMB: 20,
  allowedExtensions: ['docx', 'md', 'pdf', 'xlsx', 'xls', 'csv', 'pptx', 'txt'],
  forbiddenExtensions: ['exe', 'php', 'jsp', 'sh', 'bat', 'cmd'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// 上传限制提示文案（用于「？」悬停提示），按当前语言实时解析
export function coverImageRuleHints(): string[] {
  return tList('libUi.upload.coverHints');
}

export function blockImageRuleHints(): string[] {
  return tList('libUi.upload.blockHints');
}

export function faviconImageRuleHints(): string[] {
  return tList('libUi.upload.faviconHints');
}

export function documentRuleHints(): string[] {
  return tList('libUi.upload.docHints');
}

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx + 1).toLowerCase();
}

export function getFileNameWithoutExt(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export function validateFileName(name: string, rules: ImageUploadRules | DocumentUploadRules): string | null {
  const base = getFileNameWithoutExt(name);
  if (base.length === 0) return t('libUi.upload.fileNameEmpty');
  if (base.length > rules.maxNameLength) {
    return t('libUi.upload.fileNameTooLong', { n: rules.maxNameLength });
  }
  if (rules.forbiddenNameChars.test(base)) {
    return t('libUi.upload.fileNameSpecialChars');
  }
  return null;
}

export function validateFileExtension(name: string, rules: ImageUploadRules | DocumentUploadRules): string | null {
  const ext = getFileExtension(name);
  if (!ext) return t('libUi.upload.fileMissingExt');
  if (rules.forbiddenExtensions.includes(ext)) {
    return t('libUi.upload.fileExtForbidden', { ext });
  }
  if (!rules.allowedExtensions.includes(ext)) {
    return t('libUi.upload.fileExtAllowed', { list: rules.allowedExtensions.map((e) => e.toUpperCase()).join(' / ') });
  }
  return null;
}

export function validateFileSize(size: number, rules: ImageUploadRules | DocumentUploadRules): string | null {
  const maxBytes = rules.maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return t('libUi.upload.fileSizeTooLarge', { n: rules.maxSizeMB });
  }
  return null;
}

function loadImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function validateImageFile(file: File, rules: ImageUploadRules = BLOCK_IMAGE_RULES): Promise<string | null> {
  const nameErr = validateFileName(file.name, rules);
  if (nameErr) return nameErr;
  const extErr = validateFileExtension(file.name, rules);
  if (extErr) return extErr;
  const sizeErr = validateFileSize(file.size, rules);
  if (sizeErr) return sizeErr;
  if (rules.exactSize) {
    const size = await loadImageSize(file);
    if (!size) return t('libUi.upload.imageSizeUnreadable');
    if (size.width !== rules.exactSize.width || size.height !== rules.exactSize.height) {
      return t('libUi.upload.imageSizeMismatch', { w: rules.exactSize.width, h: rules.exactSize.height });
    }
  }
  return null;
}

export function validateDocumentFile(file: File, rules: DocumentUploadRules = DEFAULT_DOCUMENT_RULES): string | null {
  const nameErr = validateFileName(file.name, rules);
  if (nameErr) return nameErr;
  const extErr = validateFileExtension(file.name, rules);
  if (extErr) return extErr;
  const sizeErr = validateFileSize(file.size, rules);
  if (sizeErr) return sizeErr;
  return null;
}
