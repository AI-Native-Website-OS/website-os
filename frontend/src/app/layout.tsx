import type { Metadata } from 'next';
import { AuthProvider } from '@/hooks/useAuth';

import ScrollToTop from '@/components/ScrollToTop';
import SiteFavicon from '@/components/SiteFavicon';
import SiteJsonLd from '@/components/SiteJsonLd';
import SiteTitle from '@/components/SiteTitle';
import ThemeProvider from '@/components/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '官网',
    template: '%s - 官网',
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
          'function applyTheme(mode,color){',
          'try{',
          'var dark=(mode==="dark")||(mode==="auto"&&window.matchMedia("(prefers-color-scheme:dark)").matches);',
          'if(dark)document.documentElement.classList.add("dark");',
          'if(color)document.documentElement.style.setProperty("--primary-color",color);',
          '}catch(e){}',
          '}',
          'try{',
          'var mode=null,color=null;',
          'var x=new XMLHttpRequest();',
          'x.open("GET","/api/home/theme",false);',
          'try{x.send(null);}catch(e){}',
          'if(x.status===200){',
          'try{var d=JSON.parse(x.responseText);if(d&&d.data){mode=d.data.themeMode;color=d.data.primaryColor;}}catch(e){}',
          '}',
          'applyTheme(mode,color);',
          '}catch(e){}',
          '})();',
        ].join('') }} />
        <SiteJsonLd />
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
            <SiteTitle />
            <ThemeProvider>
              <main>{children}</main>
            </ThemeProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
