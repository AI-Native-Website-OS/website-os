'use client';

import { useEffect, useRef } from 'react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { getImageUrl } from '@/lib/utils';

function withCacheBust(url: string, v: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${v}`;
}

export default function SiteFavicon() {
  const { siteConfig } = useSiteConfig();
  const appliedBase = useRef('');
  const version = useRef(0);

  useEffect(() => {
    const fallback = '/logo-lable.png';
    const resolved = getImageUrl(siteConfig.favicon);
    // WebP 不被浏览器作为 favicon 稳定支持，配置了 WebP 时回退到默认 PNG
    const href = resolved && !/\.webp$/i.test(resolved) ? resolved : fallback;
    if (appliedBase.current === href) return;
    appliedBase.current = href;
    version.current += 1;

    // Chrome 只可靠响应「移除旧 link 后重新插入新 link」的动态更新，
    // 直接修改已有 link 的 href 会被忽略，且浏览器按 URL 强缓存 favicon，
    // 因此每次更换时追加版本参数强制重新请求。
    document.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    ).forEach((link) => link.remove());

    const key = withCacheBust(href, version.current);
    for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = key;
      document.head.appendChild(link);
    }
  }, [siteConfig.favicon]);

  return null;
}