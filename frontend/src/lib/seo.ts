/**
 * 站点身份（名称/域名/描述）运行时从后端站点配置（system_configs.site_brand）获取，
 * 不在代码中硬编码；SEO/GEO 配置页修改后即时生效。
 */
export interface SiteIdentity {
  name: string;
  url: string;
  description: string;
  logo?: string;
}

export const EMPTY_SITE_IDENTITY: SiteIdentity = {
  name: '',
  url: '',
  description: '',
  logo: '/logo.png',
};

/** 默认占位品牌名（后台未配置站点品牌时由默认配置注入），SEO/GEO 输出时视为未配置并忽略。 */
const PLACEHOLDER_BRAND_NAMES = new Set(['示例科技', '示例科技有限公司']);

/** 默认占位域名（IANA 保留示例域名），未配置站点域名时视为未配置并忽略。 */
function isPlaceholderDomain(url: string): boolean {
  return /\.example\.com$/i.test(url);
}

/** 从站点配置对象构造站点身份，供 schema/canonical 等使用。 */
export function toSiteIdentity(cfg?: {
  siteName?: string;
  siteFullName?: string;
  siteDescription?: string;
  url?: string;
  logo?: string;
} | null): SiteIdentity {
  const rawName = (cfg?.siteName || '').trim();
  const rawFull = (cfg?.siteFullName || '').trim();
  const name = PLACEHOLDER_BRAND_NAMES.has(rawName) ? '' : rawName;
  const full = PLACEHOLDER_BRAND_NAMES.has(rawFull) ? '' : rawFull;
  const rawUrl = (cfg?.url || '').replace(/\/+$/, '');
  return {
    name: (name || full).trim(),
    url: isPlaceholderDomain(rawUrl) ? '' : rawUrl,
    description: (cfg?.siteDescription || '').trim(),
    logo: cfg?.logo || '/logo.png',
  };
}

export function defaultOgImage(site: SiteIdentity = EMPTY_SITE_IDENTITY): string {
  return site.url ? `${site.url}/og-image.png` : (site.logo || '/logo.png');
}

export interface SeoProps {
  title: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  noindex?: boolean;
  nofollow?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function getCanonicalUrl(path: string, site: SiteIdentity = EMPTY_SITE_IDENTITY): string {
  return `${site.url}${path}`;
}

/**
 * 将结构化数据安全序列化为可注入 <script type="application/ld+json"> 的字符串。
 * JSON.stringify 不会转义 "<"、">"、"&"，CMS 文本中的 "</script>" 可逃逸出 JSON 块执行脚本；
 * 这里转义为等价的 \uXXXX，保证不破坏 JSON 语义的同时无法闭合 script 标签。
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function generateBreadcrumbSchema(
  items: BreadcrumbItem[],
  site: SiteIdentity = EMPTY_SITE_IDENTITY,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${site.url}${item.url}`,
    })),
  };
}

export function generateProductSchema(product: {
  name: string;
  description: string;
  image?: string;
  slug: string;
  category?: string;
  moduleKey?: string;
}, site: SiteIdentity = EMPTY_SITE_IDENTITY): object {
  const url = product.moduleKey
    ? `${site.url}/list/detail?moduleKey=${product.moduleKey}&slug=${product.slug}`
    : `${site.url}/list/detail?moduleKey=products&slug=${product.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image || defaultOgImage(site),
    url,
    brand: {
      '@type': 'Brand',
      name: site.name,
    },
    category: product.category || '企业软件',
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'CNY',
    },
  };
}

export function generateArticleSchema(article: {
  title: string;
  description: string;
  content?: string;
  image?: string;
  slug: string;
  author?: string;
  publishedAt: string;
  modifiedAt?: string;
  category?: string;
  moduleKey?: string;
}, site: SiteIdentity = EMPTY_SITE_IDENTITY): object {
  const url = article.moduleKey
    ? `${site.url}/list/detail?moduleKey=${article.moduleKey}&slug=${article.slug}`
    : `${site.url}/list/detail?moduleKey=resources&slug=${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image || defaultOgImage(site),
    author: {
      '@type': 'Person',
      name: article.author || site.name,
    },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: {
        '@type': 'ImageObject',
        url: site.url ? `${site.url}/logo.png` : (site.logo || '/logo.png'),
      },
    },
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt || article.publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    articleSection: article.category || '行业资讯',
  };
}

export function generateFaqSchema(faqs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateSoftwareApplicationSchema(app: {
  name: string;
  description: string;
  category?: string;
  url?: string;
}, site: SiteIdentity = EMPTY_SITE_IDENTITY): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: app.description,
    applicationCategory: app.category || 'BusinessApplication',
    operatingSystem: 'Web',
    url: app.url || site.url,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    author: {
      '@type': 'Organization',
      name: site.name,
    },
  };
}
