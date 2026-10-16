import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import config from '@/config';
import { getLocale } from '@/lib/localeStore';
import { t } from '@/i18n/translate';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalizedPath = path.startsWith('/') ? path : '/uploads/' + path;
  // 根路径但非 /uploads/ 下的资源（如 /logo.png 等公开静态文件）由前端自身提供，直接返回
  if (!normalizedPath.startsWith('/uploads/')) return normalizedPath;
  const base = config.upload.baseUrl.replace(/\/+$/, '');
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getFileUrl(filePath?: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const normalized = filePath.startsWith('/') ? filePath : '/uploads/' + filePath;
  const base = config.upload.baseUrl.replace(/\/+$/, '');
  return base ? `${base}${normalized}` : normalized;
}

export async function downloadFile(fileUrl: string, fileName?: string): Promise<void> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(t('libUi.utils.downloadFailed'));
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName || fileUrl.split('/').pop()?.split('?')[0] || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString(getLocale() === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateVisitorId() {
  return secureRandomString(13) + secureRandomString(13);
}

export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

export function secureRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const COVER_SCALE_VALUES = [
  '1920x1080',
  '1728x972',
  '1536x864',
  '1440x810',
  '1344x756',
  '1286x724',
  '1280x720',
  '1200x675',
  '1152x648',
  '960x540',
] as const;

/** 封面缩放比例选项（label 按当前语言实时解析）。 */
export function coverScaleOptions(): { value: string; label: string }[] {
  return COVER_SCALE_VALUES.map((value) => ({ value, label: t(`libUi.coverScale.${value}`) }));
}

export const DEFAULT_COVER_SCALE = '1920x1080';

export function parseCoverScale(scale?: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(scale || '');
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  return { width: 1920, height: 1080 };
}
