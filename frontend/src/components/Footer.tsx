'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { FooterConfig } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { listUrl, categoryUrl, detailUrl } from '@/lib/moduleConfig';

interface FooterColumn {
  key: string;
  name: string;
  items: { name: string; href: string }[];
}

export default function Footer() {
  const [columns, setColumns] = useState<FooterColumn[]>([]);
  const [footer, setFooter] = useState<FooterConfig | null>(null);
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();

  useEffect(() => {
    (async () => {
      const [coreModRes, footerRes] = await Promise.all([
        api.get('/core-modules').catch(() => ({ data: [] })),
        api.get('/home/footer').catch(() => ({ data: null })),
      ]);

      const activeModules = ((coreModRes.data || []).filter((m: any) => m.status === 1) || []) as any[];
      const moduleColumns: FooterColumn[] = [];

      const fetchPromises = activeModules.map(async (m: any) => {
        const listRes: any = await api.get(`/content/${m.moduleKey}`, { params: { page: 1, size: 50 } }).catch(() => ({ data: { records: [] } }));
        const records = (listRes.data?.records || []) as any[];

        let items: { name: string; href: string }[] = [];
        if (m.moduleType === 1) {
          const catRes: any = await api.get(`/content/${m.moduleKey}/categories`).catch(() => ({ data: [] }));
          const cats = (catRes.data || []) as any[];
          const catMap: Record<string, string> = {};
          cats.filter((c: any) => c.name && c.slug).forEach((c: any) => { catMap[c.name] = c.slug; });
          const groupNames = [...new Set(records.map((r: any) => r.groupName?.trim()).filter(Boolean))];
          items = groupNames.map((name: string) => ({
            name,
            href: categoryUrl(m.moduleKey, catMap[name] || name),
          }));
        } else {
          items = records.slice(0, 50).map((r: any) => ({
            name: r.title,
            href: detailUrl(m.moduleKey, r.slug),
          }));
        }

        return { key: m.moduleKey, name: m.moduleName, items };
      });

      const results = await Promise.all(fetchPromises);
      results.forEach((col) => { if (col.items.length > 0) moduleColumns.push(col); });

      moduleColumns.push({
        key: 'faqs',
        name: t('common.footer.faq'),
        items: [{ name: t('common.footer.faq'), href: '/faqs' }],
      });

      setColumns(moduleColumns);
      setFooter((footerRes.data || {}) as FooterConfig);
    })();
  }, []);

  const year = new Date().getFullYear();
  const companyName = footer?.extra?.find((it) => it.label === '公司名称')?.value || '圣诺联合';

  const contactItems: { label: string; value: string }[] = (footer?.extra || [])
    .filter((it) => it.value && it.value.trim())
    .map((it) => ({ label: it.label, value: it.value }));

  const linkFor = (label: string) => {
    if (/电话|手机|座机|热线/.test(label)) return (v: string) => `tel:${v}`;
    if (/邮箱|邮件/.test(label)) return (v: string) => `mailto:${v}`;
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
          <div className="flex flex-col md:flex-row gap-8 md:gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <img src={getImageUrl(footer?.logo) || '/logo.png'} alt={companyName} className="h-8 w-auto opacity-70 shrink-0" />
                <span className="text-sm text-gray-500">&copy; {year} {footer?.copyright || `${t('common.footer.aboutUs')} ${t('common.footer.rightsReserved')}`}</span>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
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
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-500">
              {contactItems.map((c, i) => {
                const hrefFn = linkFor(c.label);
                const href = hrefFn ? hrefFn(c.value) : null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-gray-400">{c.label}:</span>
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
    </footer>
  );
}
