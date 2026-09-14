'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig } from '@/hooks/useSiteConfig';
import { safeJsonLd, toSiteIdentity } from '@/lib/seo';

/**
 * 站点 Organization / WebSite 结构化数据：运行时从站点配置读取，
 * 后台 SEO/GEO / 站点配置修改后即时生效，不在代码中硬编码品牌信息。
 */
export default function SiteJsonLd() {
  const [jsonLd, setJsonLd] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSiteConfig()
      .then((cfg) => {
        if (cancelled) return;
        const identity = toSiteIdentity(cfg);
        const name = identity.name;
        const url = identity.url;
        const description = identity.description;
        if (!name && !url) return;
        const orgId = url ? `${url}/#organization` : '#organization';
        const websiteId = url ? `${url}/#website` : '#website';
        const org: Record<string, unknown> = {
          '@type': 'Organization',
          '@id': orgId,
        };
        if (name) org.name = name;
        if (url) org.url = url;
        if (identity.logo) org.logo = { '@type': 'ImageObject', url: identity.logo };
        if (description) org.description = description;
        const contactPoint: Record<string, unknown> = { '@type': 'ContactPoint' };
        if (cfg.contactPhone) contactPoint.telephone = cfg.contactPhone;
        if (cfg.contactEmail) contactPoint.email = cfg.contactEmail;
        if (cfg.contactPhone || cfg.contactEmail) {
          contactPoint.contactType = 'customer service';
          org.contactPoint = [contactPoint];
        }
        setJsonLd({
          '@context': 'https://schema.org',
          '@graph': [
            org,
            {
              '@type': 'WebSite',
              '@id': websiteId,
              ...(url ? { url } : {}),
              ...(name ? { name } : {}),
              publisher: { '@id': orgId },
            },
          ],
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!jsonLd) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  );
}
