import { useEffect, useState } from 'react';
import Head from 'next/head';
import api from '@/lib/api';
import type { SeoConfig } from '@/types';
import { SeoProps, SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, getCanonicalUrl, BreadcrumbItem, generateBreadcrumbSchema } from '@/lib/seo';

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
  const lookupUrl = getCanonicalUrl(path);

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

  const fullTitle = effectiveTitle.includes(SITE_NAME) ? effectiveTitle : `${effectiveTitle} - ${SITE_NAME}`;
  const desc = effectiveDescription || '中国领先的企业数字基础设施服务商';
  const canonicalUrl = effectiveCanonical || getCanonicalUrl(path);
  const image = effectiveOgImage || DEFAULT_OG_IMAGE;
  const robots = effectiveRobots || `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`;

  const schemas: object[] = [...additionalSchemas];
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(breadcrumbs));
  }

  useEffect(() => {
    const apply = () => {
      if (document.title !== fullTitle) document.title = fullTitle;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
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
        <meta property="og:title" content={effectiveOgTitle.includes(SITE_NAME) ? effectiveOgTitle : `${effectiveOgTitle} - ${SITE_NAME}`} />
        <meta property="og:description" content={effectiveOgDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={image} />
        <meta property="og:site_name" content={SITE_NAME} />
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
