import type { Metadata } from 'next';
import { AuthProvider } from '@/hooks/useAuth';

import ScrollToTop from '@/components/ScrollToTop';
import SiteFavicon from '@/components/SiteFavicon';
import { I18nProvider } from '@/i18n/I18nProvider';
import { safeJsonLd } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '圣诺江苏官网',
    template: '%s - 圣诺江苏官网',
  },
  description: '圣诺联合是中国领先的企业数字基础设施服务商，为政府和国企提供智慧招采平台、可信数据空间、分布式数据治理、区块链可信基础设施和AI智能体应用等全方位数字化转型解决方案。',
  keywords: '企业数字化,数字基础设施,智慧招采,可信数据空间,区块链,AI智能体,数据治理,政府采购,数字化转型,圣诺联合,SinoUnion',
  authors: [{ name: '圣诺联合科技有限公司' }],
  creator: '圣诺联合科技有限公司',
  publisher: '圣诺联合科技有限公司',
  metadataBase: new URL('https://www.example.cn'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://www.example.cn',
    siteName: '圣诺江苏官网',
    title: '圣诺江苏官网',
    description: '中国领先的企业数字基础设施服务商，专注于智慧招采、可信数据空间、区块链和AI智能体应用。',
    images: [{ url: '/logo.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '圣诺江苏官网',
    description: '中国领先的企业数字基础设施服务商',
    images: ['/logo.png'],
  },
  icons: {
    icon: '/logo-lable.png',
    apple: '/logo-lable.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.example.cn/#organization',
      name: '圣诺联合科技有限公司',
      alternateName: 'SinoUnion',
      url: 'https://www.example.cn',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.example.cn/logo.png',
      },
      description: '中国领先的企业数字基础设施服务商，专注于智慧招采、可信数据空间、分布式数据治理、区块链和AI智能体应用。',
      foundingDate: '2020',
      slogan: '企业数字基础设施服务商',
      knowsAbout: [
        '智慧招采',
        '可信数据空间',
        '分布式数据治理',
        '区块链可信基础设施',
        'AI智能体应用',
        '企业数字化转型',
        '政府采购',
        '数据要素',
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: '+86-400-XXX-XXXX',
          contactType: 'customer service',
          email: 'contact@example.cn',
          availableLanguage: ['Chinese', 'English'],
        },
        {
          '@type': 'ContactPoint',
          telephone: '+86-400-XXX-XXXX',
          contactType: 'sales',
          email: 'sales@example.cn',
          availableLanguage: ['Chinese'],
        },
      ],
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.example.cn/#website',
      url: 'https://www.example.cn',
      name: '圣诺江苏官网',
      description: '企业数字基础设施服务商官方网站',
      publisher: { '@id': 'https://www.example.cn/#organization' },
      inLanguage: 'zh-CN',
    },
    {
      '@type': 'WebPage',
      '@id': 'https://www.example.cn/#webpage',
      url: 'https://www.example.cn',
      name: '圣诺江苏官网 - 企业数字基础设施服务商',
      isPartOf: { '@id': 'https://www.example.cn/#website' },
      about: { '@id': 'https://www.example.cn/#organization' },
      description: '中国领先的企业数字基础设施服务商',
      inLanguage: 'zh-CN',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: [
          '(function(){',
          'try{',
          'var m=localStorage.getItem("site_theme_mode");',
          'if(m==="dark"||(m==="auto"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){',
          'document.documentElement.classList.add("dark");',
          '}',
          '}catch(e){}',
          '})();',
        ].join('') }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      </head>
      <body className="bg-white text-black antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: [
          '(function(){',
          'if(window.location.hash)return;',
          'if("scrollRestoration" in history)history.scrollRestoration="manual";',
          'var s=function(){try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0}catch(e){}};',
          's();',
          'document.addEventListener("DOMContentLoaded",function(){if(!window.location.hash)s()});',
          'window.addEventListener("load",function(){if(!window.location.hash)s()});',
          'window.addEventListener("pageshow",function(){if(!window.location.hash)s()});',
          'var i=setInterval(function(){if(window.scrollY!==0&&!window.location.hash)s()},200);',
          'setTimeout(function(){clearInterval(i)},1000);',
          '})();',
        ].join('') }} />
        <I18nProvider>
          <AuthProvider>
            <ScrollToTop />
            <SiteFavicon />
            <main>{children}</main>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
