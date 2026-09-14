import { useEffect, useState } from 'react';
import Head from 'next/head';
import api from '@/lib/api';
import type { SeoConfig } from '@/types';
import { getSiteConfig } from '@/hooks/useSiteConfig';
import { SeoProps, SiteIdentity, EMPTY_SITE_IDENTITY, toSiteIdentity, defaultOgImage, getCanonicalUrl, BreadcrumbItem, generateBreadcrumbSchema, safeJsonLd } from '@/lib/seo';

interface SeoHeadProps extends SeoProps {
  path: string;
  breadcrumbs?: BreadcrumbItem[];
  additionalSchemas?: object[];
  pageId?: number;
}

const configCache = new Map<string, SeoConfig | null>();

function cacheKey(url: string, pageId?: number): string {
  return pageId ? `${url}#${pageId}` : url;
}

export default function SeoHead({
  title,
  description,
  keywords,
  canonical,
  ogType = 'website',
  ogImage,
  noindex = false,
  nofollow = false,
  publishedTime,
  modifiedTime,
  author,
  section,
  tags,
  path,
  breadcrumbs,
  additionalSchemas = [],
  pageId,
}: SeoHeadProps) {
  const [dbConfig, setDbConfig] = useState<SeoConfig | null>(null);
  const [site, setSite] = useState<SiteIdentity>(EMPTY_SITE_IDENTITY);

  useEffect(() => {
    let cancelled = false;
    getSiteConfig()
      .then((cfg) => { if (!cancelled) setSite(toSiteIdentity(cfg)); })
      .catch(() => { if (!cancelled) setSite(EMPTY_SITE_IDENTITY); });
    return () => { cancelled = true; };
  }, []);

  const lookupUrl = getCanonicalUrl(path, site);

  useEffect(() => {
    const key = cacheKey(lookupUrl, pageId);
    if (configCache.has(key)) {
      setDbConfig(configCache.get(key) || null);
      return;
    }
    let cancelled = false;
    api.get<any, any>('/seo', { params: { url: lookupUrl, pageId } })
      .then((res) => {
        const cfg = res?.data ?? null;
        const value = cfg || null;
        if (!cancelled) setDbConfig(value);
        configCache.set(key, value);
      })
      .catch(() => {
        if (!cancelled) setDbConfig(null);
        configCache.set(key, null);
      });
    return () => { cancelled = true; };
  }, [lookupUrl, pageId]);

  const effectiveTitle = dbConfig?.title || title;
  const effectiveDescription = dbConfig?.description || description;
  const effectiveKeywords = dbConfig?.keywords || keywords;
  const effectiveCanonical = dbConfig?.canonicalUrl || canonical;
  const effectiveOgTitle = dbConfig?.ogTitle || effectiveTitle;
  const effectiveOgDescription = dbConfig?.ogDescription || effectiveDescription;
  const effectiveOgImage = dbConfig?.ogImage || ogImage;
  const effectiveOgType = dbConfig?.ogType || ogType;
  const effectiveRobots = dbConfig?.robots;

  const fullTitle = (site.name && !effectiveTitle.includes(site.name))
    ? `${effectiveTitle} - ${site.name}`
    : effectiveTitle;
  const ogTitle = (site.name && !effectiveOgTitle.includes(site.name))
    ? `${effectiveOgTitle} - ${site.name}`
    : effectiveOgTitle;
  const desc = effectiveDescription || site.description || '';
  const canonicalUrl = effectiveCanonical || getCanonicalUrl(path, site);
  const image = effectiveOgImage || defaultOgImage(site);
  const robots = effectiveRobots || `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`;

  const schemas: object[] = [...additionalSchemas];
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(breadcrumbs, site));
  }

  useEffect(() => {
    document.title = fullTitle;
  }, [fullTitle]);

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={desc} />
        {effectiveKeywords && <meta name="keywords" content={effectiveKeywords} />}
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content={robots} />

        <meta property="og:type" content={effectiveOgType} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={effectiveOgDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={image} />
        {site.name && <meta property="og:site_name" content={site.name} />}
        <meta property="og:locale" content="zh_CN" />
        {publishedTime && <meta property="article:published_time" content={publishedTime} />}
        {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
        {author && <meta property="article:author" content={author} />}
        {section && <meta property="article:section" content={section} />}
        {tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={image} />
      </Head>

      {schemas.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
        />
      ))}
    </>
  );
}
