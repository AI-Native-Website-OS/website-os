'use client';

import { useEffect, useRef } from 'react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { toSiteIdentity } from '@/lib/seo';

/**
 * 全局标签页标题后缀：运行时从站点配置读取「站点名称」，
 * 将 document.title 统一补齐为「页面名 - 站点名」。
 * 后台页面（未使用 SeoHead）也生效；站点名为占位名或未配置时保持原样。
 */
export default function SiteTitle() {
  const { siteConfig } = useSiteConfig();
  const prevNameRef = useRef('');

  useEffect(() => {
    const name = toSiteIdentity(siteConfig).name;
    if (!name) return;

    const suffix = ` - ${name}`;
    const apply = () => {
      let base = document.title;
      const prev = prevNameRef.current;
      if (prev && prev !== name && base.endsWith(` - ${prev}`)) {
        base = base.slice(0, -(` - ${prev}`).length);
      }
      if (!base || base.includes(name) || base.endsWith(suffix)) {
        prevNameRef.current = name;
        return;
      }
      document.title = `${base}${suffix}`;
      prevNameRef.current = name;
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [siteConfig]);

  return null;
}