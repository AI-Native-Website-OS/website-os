// 内容管理上传规则（图片/文档）
// 仅当组件传入 rules 时才启用校验；Logo、公安图标等不传规则即不受影响。

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

// HTML 模板内嵌图片规则：不限制尺寸（尺寸由 HTML 排版决定），其余与区块图片一致
export const HTML_IMAGE_RULES: ImageUploadRules = {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  forbiddenExtensions: ['svg', 'gif', 'ico', 'bmp', 'tiff'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// 默认文档规则：内容管理中新增内容的关联文档
export const DEFAULT_DOCUMENT_RULES: DocumentUploadRules = {
  maxSizeMB: 20,
  allowedExtensions: ['doc', 'docx', 'pdf'],
  forbiddenExtensions: ['exe', 'php', 'jsp', 'sh', 'bat', 'cmd'],
  maxNameLength: 100,
  forbiddenNameChars: /[\\/:*?"<>|]/,
};

// 上传限制提示文案（用于「？」悬停提示）
export const COVER_IMAGE_RULE_HINTS: string[] = [
  '图片大小：≤ 10MB',
  '图片格式：仅支持 jpg / jpeg / png / webp（禁止 svg / gif / ico / bmp / tiff）',
  '图片名称：长度 ≤ 100 字符，禁止特殊字符',
  '图片尺寸：必须为 1920 × 1080',
];

export const BLOCK_IMAGE_RULE_HINTS: string[] = [
  '图片大小：≤ 10MB',
  '图片格式：仅支持 jpg / jpeg / png / webp（禁止 svg / gif / ico / bmp / tiff）',
  '图片名称：长度 ≤ 100 字符，禁止特殊字符',
  '图片尺寸：必须为 1920 × 800',
];

export const DOCUMENT_RULE_HINTS: string[] = [
  '文件大小：≤ 20MB',
  '文件格式：仅支持 doc / docx / pdf（禁止 exe / php / jsp / sh / bat / cmd）',
  '文件名称：长度 ≤ 100 字符，禁止特殊字符',
];

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
  if (base.length === 0) return '文件名不能为空';
  if (base.length > rules.maxNameLength) {
    return `文件名长度不能超过 ${rules.maxNameLength} 个字符`;
  }
  if (rules.forbiddenNameChars.test(base)) {
    return '文件名不能包含特殊字符（\\ / : * ? " < > | 等）';
  }
  return null;
}

export function validateFileExtension(name: string, rules: ImageUploadRules | DocumentUploadRules): string | null {
  const ext = getFileExtension(name);
  if (!ext) return '文件缺少扩展名';
  if (rules.forbiddenExtensions.includes(ext)) {
    return `不支持 ${ext} 格式的文件`;
  }
  if (!rules.allowedExtensions.includes(ext)) {
    return `仅支持 ${rules.allowedExtensions.map((e) => e.toUpperCase()).join(' / ')} 格式`;
  }
  return null;
}

export function validateFileSize(size: number, rules: ImageUploadRules | DocumentUploadRules): string | null {
  const maxBytes = rules.maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return `文件大小不能超过 ${rules.maxSizeMB}MB`;
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
    if (!size) return '无法读取图片尺寸';
    if (size.width !== rules.exactSize.width || size.height !== rules.exactSize.height) {
      return `图片尺寸必须为 ${rules.exactSize.width} × ${rules.exactSize.height}`;
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
