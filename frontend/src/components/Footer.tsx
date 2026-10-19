'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getImageUrl, getExternalLink } from '@/lib/utils';
import { FooterConfig } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { listUrl, categoryUrl, categoryFilterValue, detailUrl } from '@/lib/moduleConfig';

interface FooterColumn {
  key: string;
  name: string;
  items: { name: string; href: string }[];
}

async function fetchFooterColumn(m: any): Promise<FooterColumn> {
  let items: { name: string; href: string }[] = [];

  if (m.moduleType === 1) {
    // 嵌套模块：直接使用启用分类（含无内容分类），与首页区块 / 列表页筛选保持一致
    const catRes: any = await api.get(`/content/${m.moduleKey}/categories`).catch(() => ({ data: [] }));
    const cats = (catRes.data || []) as any[];
    items = cats
      .filter((c: any) => c.name)
      .map((c: any) => ({
        name: c.name,
        href: categoryUrl(m.moduleKey, categoryFilterValue(c)),
      }));
  } else {
    const listRes: any = await api.get(`/content/${m.moduleKey}`, { params: { page: 1, size: 50 } }).catch(() => ({ data: { records: [] } }));
    const records = (listRes.data?.records || []) as any[];
    items = records.slice(0, 50).map((r: any) => ({
      name: r.title,
      href: detailUrl(m.moduleKey, r.slug),
    }));
  }

  const count = m.moduleColumns && m.moduleColumns >= 1 && m.moduleColumns <= 6 ? m.moduleColumns : 4;
  return { key: m.moduleKey, name: m.moduleName, items: items.slice(0, count) };
}

export default function Footer() {
  const [columns, setColumns] = useState<FooterColumn[]>([]);
  const [footer, setFooter] = useState<FooterConfig | null>(null);
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();

  useEffect(() => {
    const handleModulesChanged = () => {
      (async () => {
        const [coreModRes, footerRes] = await Promise.all([
          api.get('/core-modules').catch(() => ({ data: [] })),
          api.get('/home/footer').catch(() => ({ data: null })),
        ]);

        const activeModules = ((coreModRes.data || []).filter((m: any) => m.status === 1) || []) as any[];

        const fetchPromises = activeModules.map(fetchFooterColumn);

        const results = await Promise.all(fetchPromises);
        const allColumns: FooterColumn[] = [];

        results.forEach((col) => {
          if (col.items.length > 0) {
            allColumns.push(col);
          }
        });

        allColumns.push({
          key: 'faqs',
          name: t('common.footer.faq'),
          items: [{ name: t('common.footer.faq'), href: '/faqs' }],
        });

        setColumns(allColumns.slice(0, 5));
        setFooter((footerRes.data || {}) as FooterConfig);
      })();
    };
    handleModulesChanged();
    window.addEventListener('core-modules-changed', handleModulesChanged);
    return () => window.removeEventListener('core-modules-changed', handleModulesChanged);
  }, []);

  const year = new Date().getFullYear();
  const companyName = footer?.extra?.find((it) => it.label === '公司名称' || /company\s*name/i.test(it.label || ''))?.value
    || siteConfig.companyName || siteConfig.siteFullName || siteConfig.siteName || '';

  const contactItems: { label: string; value: string }[] = (footer?.extra || [])
    .filter((it) => it.value && it.value.trim())
    .map((it) => ({ label: it.label, value: it.value }));

  const qrcodes = (footer?.qrcodes || []).filter((q) => q.image && q.image.trim());

  const links = (footer?.links || []).filter((l) => l.name && l.name.trim() && l.url && l.url.trim());

  const linkFor = (label: string) => {
    if (/电话|手机|座机|热线|phone|tel|mobile|hotline/i.test(label)) return (v: string) => `tel:${v}`;
    if (/邮箱|邮件|email|mail/i.test(label)) return (v: string) => `mailto:${v}`;
    return null;
  };

  return (
    <footer className="flex-shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-xl">
      <div className="max-w-[90rem] mx-auto px-5 sm:px-6 py-16">
        <div className="flex flex-nowrap justify-evenly gap-6 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div key={col.key} className="min-w-[140px] shrink-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-5 tracking-wide">
                <Link href={col.key === 'faqs' ? '/faqs' : listUrl(col.key)} className="hover:text-black transition-colors">{col.name}</Link>
              </h3>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-500 hover:text-black transition-all duration-200 hover:translate-x-0.5 inline-block break-words"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-gray-100">
          <div className="flex flex-col gap-8 md:gap-0">
            {(links.length > 0 || qrcodes.length > 0) && (
              <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-start md:gap-[60px] md:pb-10 md:border-b md:border-gray-200">
                {links.length > 0 && (
                  <div className="min-w-0 md:flex-1">
                    <h3 className="flex items-center text-sm md:text-base font-semibold text-gray-900 mb-4 md:mb-5">
                      <span className="inline-block w-[3px] md:w-1 h-4 bg-black rounded-full mr-2.5 md:mr-3" />
                      {t('common.footer.links')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-5 gap-y-3 text-sm md:text-[13px] text-gray-500">
                      {links.map((l, i) => (
                        <a
                          key={i}
                          href={getExternalLink(l.url)}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="truncate hover:text-black transition-colors"
                        >
                          {l.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {qrcodes.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-10 py-4 border-y border-dashed border-gray-100 md:shrink-0 md:justify-start md:gap-[30px] md:py-0 md:border-0">
                    {qrcodes.map((qr, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <img
                          src={getImageUrl(qr.image)}
                          alt={qr.label || 'QR code'}
                          className="h-24 w-24 object-contain rounded-lg border border-gray-100 bg-white p-1 shadow-sm"
                        />
                        {qr.label && <span className="text-xs text-gray-500">{qr.label}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-end md:gap-6 md:pt-[30px]">
              <div className="min-w-0 flex flex-col items-center text-center gap-3 md:items-start md:text-left">
                <div className="flex items-center gap-3">
                  <img src={getImageUrl(footer?.logo) || '/logo.png'} alt={companyName} className="h-8 w-auto opacity-70 shrink-0" />
                  <span className="text-sm text-gray-500">&copy; {year} {footer?.copyright || `${t('common.footer.aboutUs')} ${t('common.footer.rightsReserved')}`}</span>
                </div>
                <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-500 md:justify-start md:gap-x-2">
                  <img src={getImageUrl(footer?.policeIcon) || '/police.png'} alt="" className="h-4 w-auto shrink-0" />
                  {footer?.policeNumber && (
                    <a href={footer?.policeUrl || 'https://www.beian.gov.cn/'} target="_blank" rel="noopener noreferrer" className="hover:underline whitespace-nowrap">
                      {footer.policeNumber}
                    </a>
                  )}
                  {footer?.icpNumber && (
                    <a href={footer?.icpUrl || 'https://beian.miit.gov.cn/'} target="_blank" rel="noopener noreferrer" className="hover:underline whitespace-nowrap">
                      {footer.icpNumber}
                    </a>
                  )}
                </p>
              </div>
              <div className="min-w-0 md:text-right">
                <div className="grid grid-cols-1 gap-2.5 bg-gray-50 p-4 rounded-lg text-xs text-gray-600 md:flex md:flex-col md:items-end md:gap-2 md:bg-transparent md:p-0 md:rounded-none md:text-[13px] md:text-gray-500">
                  {contactItems.map((c, i) => {
                    const hrefFn = linkFor(c.label);
                    const href = hrefFn ? hrefFn(c.value) : null;
                    return (
                      <div key={i} className="flex items-center gap-2 max-w-full md:justify-end">
                        <span className="text-gray-400 shrink-0">{c.label}:</span>
                        {href
                          ? <a href={href} className="hover:text-black transition-colors break-words">{c.value}</a>
                          : <span className="break-words">{c.value}</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
