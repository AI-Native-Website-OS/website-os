export const SITE_URL = 'https://www.example.cn';
export const SITE_NAME = '圣诺联合';
export const SITE_DESCRIPTION = '中国领先的企业数字基础设施服务商，帮助政府、国企和企业客户建设智慧招采平台、可信数据空间、分布式数据治理平台、区块链可信基础设施和AI智能体应用。';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

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

export function getCanonicalUrl(path: string): string {
  return `${SITE_URL}${path}`;
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

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
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
}): object {
  const url = product.moduleKey
    ? `${SITE_URL}/list/detail?moduleKey=${product.moduleKey}&slug=${product.slug}`
    : `${SITE_URL}/list/detail?moduleKey=products&slug=${product.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image || DEFAULT_OG_IMAGE,
    url,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
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
}): object {
  const url = article.moduleKey
    ? `${SITE_URL}/list/detail?moduleKey=${article.moduleKey}&slug=${article.slug}`
    : `${SITE_URL}/list/detail?moduleKey=resources&slug=${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image || DEFAULT_OG_IMAGE,
    author: {
      '@type': 'Person',
      name: article.author || SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
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
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: app.description,
    applicationCategory: app.category || 'BusinessApplication',
    operatingSystem: 'Web',
    url: app.url || SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}
