import { zh, en } from './messages';
import { getLocale, type Locale } from '@/lib/localeStore';

const DICTS: Record<Locale, any> = { zh, en };

function resolveRaw(dict: any, path: string): any {
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** 非 React 模块（lib/hooks 等）使用的翻译函数，语言取自全局 localeStore。 */
export function t(key: string, params?: Record<string, string | number>): string {
  const locale = getLocale();
  const v = resolveRaw(DICTS[locale], key);
  const raw = typeof v === 'string' ? v : resolveRaw(zh, key);
  if (typeof raw !== 'string') return key;
  return interpolate(raw, params);
}

/** 非 React 模块使用的字符串数组翻译函数（如上传规则提示）。 */
export function tList(key: string): string[] {
  const locale = getLocale();
  const v = resolveRaw(DICTS[locale], key);
  const raw = Array.isArray(v) ? v : resolveRaw(zh, key);
  return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
}
