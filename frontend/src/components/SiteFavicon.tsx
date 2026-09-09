'use client';

import { useEffect } from 'react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { getImageUrl } from '@/lib/utils';

export default function SiteFavicon() {
  const { siteConfig } = useSiteConfig();

  useEffect(() => {
    const href = getImageUrl(siteConfig.favicon) || '/logo-lable.png';
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );
    if (links.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = href;
      document.head.appendChild(link);
    } else {
      links.forEach((link) => { link.href = href; });
    }
  }, [siteConfig.favicon]);

  return null;
}