import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import config from '@/config';

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

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
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
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const COVER_SCALE_OPTIONS = [
  { value: '1920x1080', label: '1920 × 1080：高清原图/大图' },
  { value: '1728x972', label: '1728 × 972' },
  { value: '1536x864', label: '1536 × 864' },
  { value: '1440x810', label: '1440 × 810：高清网页展示' },
  { value: '1344x756', label: '1344 × 756' },
  { value: '1286x724', label: '1286 × 724' },
  { value: '1280x720', label: '1280 × 720：非常通用，推荐' },
  { value: '1200x675', label: '1200 × 675：主流网页展示' },
  { value: '1152x648', label: '1152 × 648' },
  { value: '960x540', label: '960 × 540：普通网页产品图' },
] as const;

export const DEFAULT_COVER_SCALE = '1920x1080';

export function parseCoverScale(scale?: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(scale || '');
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  return { width: 1920, height: 1080 };
}
