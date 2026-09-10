'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X, ChevronDown, LayoutDashboard, LogOut, GitCompareArrows } from 'lucide-react';
import { cn, getImageUrl } from '@/lib/utils';
import { resolveOpenIcon, type OpenIconOption } from '@/lib/openSourceIcons';
import { useAuth } from '@/hooks/useAuth';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useI18n } from '@/i18n/I18nProvider';
import Avatar from '@/components/Avatar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import api from '@/lib/api';
import { moduleHref, BUILTIN_KEYS, listUrl, categoryUrl, detailUrl, nestedDetailUrl } from '@/lib/moduleConfig';

interface NavChild {
  name: string;
  href: string;
  description?: string;
}

interface NavItem {
  name: string;
  href: string;
  key?: string;
  children?: NavChild[];
  moduleType?: number;
}

const navTemplate: NavItem[] = [
  { name: '产品', href: listUrl('products'), key: 'products', children: [] },
  { name: '解决方案', href: listUrl('solutions'), key: 'solutions', children: [] },
  { name: '案例', href: listUrl('cases'), key: 'cases', children: [] },
  { name: '资源', href: listUrl('resources'), key: 'resources', children: [] },
  { name: '关于我们', href: '/about', key: 'about' },
];

interface NavGroupItem {
  name: string;
  href: string;
  description?: string;
}

interface NavGroup {
  line: string;
  slug: string;
  items: NavGroupItem[];
}

interface OpenLink {
  url: string;
  label: string;
  option: OpenIconOption;
}

async function loadHeaderData() {
  const coreModRes: any = await api.get('/core-modules').catch(() => ({ data: [] }));
  const activeModules = (coreModRes.data || []).filter((m: any) => m.status === 1) as any[];

  const fetchBuiltin = async (moduleKey: string) => {
    const listRes: any = await api.get(`/content/${moduleKey}`, { params: { page: 1, size: 50 } }).catch(() => ({ data: { records: [] } }));
    const catRes: any = await api.get(`/content/${moduleKey}/categories`).catch(() => ({ data: [] }));
    return {
      records: (listRes.data?.records || []) as any[],
      categories: (catRes.data || []) as any[],
    };
  };

  const [prodData, solData, caseData, resData] = await Promise.all([
    fetchBuiltin('products'),
    fetchBuiltin('solutions'),
    fetchBuiltin('cases'),
    fetchBuiltin('resources'),
  ]);
  const products = prodData.records;
  const productLines = prodData.categories;
  const solutions = solData.records;
  const industries = solData.categories;
  const cases = caseData.records;
  const categories = resData.categories;
  const resources = resData.records;

  const buildGroups = (moduleKey: string, records: any[], cats: any[], fallbackField: string) => {
    const groups: Record<string, NavGroupItem[]> = {};
    const catSlugMap: Record<number, string> = {};
    const catSlugByName: Record<string, string> = {};
    const catIdToName: Record<number, string> = {};
    cats.forEach((c: any) => {
      catIdToName[c.id] = c.name;
      if (c.slug) {
        catSlugMap[c.id] = c.slug;
        catSlugByName[c.name?.trim()] = c.slug;
      }
    });
    const catOrder = cats.map((c: any) => c.name?.trim()).filter(Boolean);
    records.forEach((it: any) => {
      let line = '';
      if (it.categoryId != null && catIdToName[it.categoryId]) line = catIdToName[it.categoryId];
      else line = it.groupName?.trim() || it[fallbackField]?.trim() || '其他';
      if (!groups[line]) groups[line] = [];
      const catSlug = (it.categoryId != null && catSlugMap[it.categoryId]) || catSlugByName[line] || line;
      groups[line].push({ name: it.title, href: catSlug ? nestedDetailUrl(moduleKey, catSlug, it.slug) : detailUrl(moduleKey, it.slug), description: it.summary || '' });
    });
    cats.forEach((c: any) => {
      const name = c.name?.trim();
      if (name && !groups[name]) groups[name] = [];
    });
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const ai = catOrder.indexOf(a);
        const bi = catOrder.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return 0;
      })
      .map(([line, items]) => ({ line, slug: catSlugByName[line] || line, items }));
  };

  const productGroups = buildGroups('products', products, productLines, '');
  const solutionGroups = buildGroups('solutions', solutions, industries, '');
  const resourceGroups = buildGroups('resources', resources, categories, '');

  const navItems: NavItem[] = activeModules.map((m: any) => ({
    name: m.moduleName,
    href: moduleHref(m),
    key: m.moduleKey,
    children: [],
    moduleType: m.moduleType,
  }));
  const casesNav = navItems.find(n => n.key === 'cases');
  if (casesNav) {
    casesNav.children = cases.slice(0, 10).map((c: any) => ({
      name: c.title, href: detailUrl('cases', c.slug), description: c.summary || c.groupName || '',
    }));
  }

  const genericMods = activeModules.filter((m: any) => !BUILTIN_KEYS.includes(m.moduleKey));
  const genericGroupsRes: Record<string, NavGroup[]> = {};
  const genericItemsRes: Record<string, NavChild[]> = {};
  await Promise.all(genericMods.map(async (m: any) => {
    const key = m.moduleKey;
    const listRes: any = await api.get(`/content/${key}`, { params: { page: 1, size: 50 } }).catch(() => ({ data: { records: [] } }));
    const records = (listRes.data?.records || []) as any[];
    if (m.moduleType === 2) {
      genericItemsRes[key] = records.slice(0, 10).map((it: any) => ({
        name: it.title, href: detailUrl(key, it.slug), description: it.summary || '',
      }));
      return;
    }
    const groupsRes: any = await api.get(`/content/${key}/categories`).catch(() => ({ data: [] }));
    const groups = (groupsRes.data || []) as any[];
    const nameToSlug: Record<string, string> = {};
    const idToSlug: Record<string, string> = {};
    const idToName: Record<string, string> = {};
    groups.forEach((g: any) => {
      if (g.name) nameToSlug[g.name] = g.slug || g.name;
      if (g.id) { idToSlug[String(g.id)] = g.slug || String(g.id); idToName[String(g.id)] = g.name; }
    });
    const grouped: Record<string, NavGroupItem[]> = {};
    records.forEach((it: any) => {
      const catId = it.categoryId != null ? String(it.categoryId) : '';
      const line = (catId && idToName[catId]) || it.groupName || '其他';
      const catSlug = (catId && idToSlug[catId]) || nameToSlug[line] || line;
      if (!grouped[line]) grouped[line] = [];
      grouped[line].push({ name: it.title, href: nestedDetailUrl(key, catSlug, it.slug), description: it.summary || '' });
    });
    groups.forEach((g: any) => { if (g.name && !grouped[g.name]) grouped[g.name] = []; });
    genericGroupsRes[key] = Object.entries(grouped).map(([line, items]) => ({ line, slug: nameToSlug[line] || line, items }));
  }));

  return {
    productGroups,
    solutionGroups,
    resourceGroups,
    genericGroups: genericGroupsRes,
    genericItems: genericItemsRes,
    navigation: [
      ...navItems,
      { name: '关于我们', href: '/about', key: 'about' },
    ] as NavItem[],
  };
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navigation, setNavigation] = useState<NavItem[]>(navTemplate);
  const [productGroups, setProductGroups] = useState<NavGroup[]>([]);
  const [solutionGroups, setSolutionGroups] = useState<NavGroup[]>([]);
  const [resourceGroups, setResourceGroups] = useState<NavGroup[]>([]);
  const [genericGroups, setGenericGroups] = useState<Record<string, NavGroup[]>>({});
  const [genericItems, setGenericItems] = useState<Record<string, NavChild[]>>({});
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const navItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout, isAdmin } = useAuth();
  const { siteConfig } = useSiteConfig();
  const { t } = useI18n();

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleNavEnter = (key: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverRect({ left: rect.left, top: rect.bottom });
    setHoveredNav(key);
  };

  const handleNavLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoveredNav(null), 120);
  };

  const handlePanelEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  const handlePanelLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoveredNav(null), 120);
  };

  const handleNavScroll = () => {
    if (!hoveredNav) return;
    const el = navItemRefs.current[hoveredNav];
    if (el) {
      const rect = el.getBoundingClientRect();
      setHoverRect({ left: rect.left, top: rect.bottom });
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (!hoverRect || !panelRef.current) return;
    const w = panelRef.current.offsetWidth;
    const vw = window.innerWidth;
    setPanelLeft(Math.max(8, Math.min(hoverRect.left, vw - w - 8)));
  }, [hoveredNav, hoverRect]);

  const opensourceLinks: OpenLink[] = (siteConfig.openLinks || [])
    .filter((l) => l.enabled !== false && Boolean(l.url && l.url.trim()))
    .map((l) => ({
      url: l.url,
      label: l.label || l.url,
      option: resolveOpenIcon(l.icon),
    }));

  const navLabel = (item: NavItem): string => {
    if (item.key === 'about') return t('nav.about');
    return item.name;
  };

  const emptyTextFor = (key: string): string => {
    const map: Record<string, string> = {
      products: t('nav.noProducts'),
      solutions: t('nav.noSolutions'),
      cases: t('nav.noCases'),
      resources: t('nav.noResources'),
    };
    return map[key] || t('nav.noContent');
  };

  const viewAllFor = (key: string): string => {
    const map: Record<string, string> = {
      products: t('nav.viewAllProducts'),
      solutions: t('nav.viewAllSolutions'),
      cases: t('nav.viewAllCases'),
      resources: t('nav.viewAllResources'),
    };
    return map[key] || t('common.viewAll');
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleModulesChanged = () => {
      (async () => {
        const data = await loadHeaderData();
        setProductGroups(data.productGroups);
        setSolutionGroups(data.solutionGroups);
        setResourceGroups(data.resourceGroups);
        setGenericGroups(data.genericGroups);
        setGenericItems(data.genericItems);
        setNavigation(data.navigation);
      })();
    };
    handleModulesChanged();
    window.addEventListener('core-modules-changed', handleModulesChanged);
    return () => window.removeEventListener('core-modules-changed', handleModulesChanged);
  }, []);

  function renderNavCardItem(item: NavGroupItem) {
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.name}
        className="group/card block px-2 py-1.5 rounded-lg transition-all duration-200 hover:-translate-y-[3px] hover:shadow-sm hover:bg-gray-50/80"
      >
        <div className="text-xs font-medium text-gray-700 group-hover/card:text-gray-900 transition-colors duration-200 whitespace-nowrap overflow-hidden text-ellipsis">
          {item.name}
        </div>
        {item.description && (
          <div className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-1">
            {item.description}
          </div>
        )}
      </Link>
    );
  }

  function renderCardDropdown(groups: NavGroup[], emptyText: string, hrefPrefix: string, _queryKey: string, maxLines: number = 5) {
    const ITEMS_PER_COL = maxLines;
    const displayGroups = groups;
    return (
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-100 p-3 max-w-[80vw] min-w-[480px]">
        {displayGroups.length === 0 && <div className="px-3 py-6 text-xs text-gray-400 text-center">{emptyText}</div>}
        {displayGroups.length > 0 && (
          <>
            <div className="flex flex-nowrap gap-x-3 overflow-x-auto max-h-[70vh] overflow-y-auto">
              {displayGroups.map((group, gIdx) => {
                const itemCols: NavGroupItem[][] = [];
                for (let i = 0; i < group.items.length; i += ITEMS_PER_COL) {
                  itemCols.push(group.items.slice(i, i + ITEMS_PER_COL));
                }
                return (
                  <React.Fragment key={group.line}>
                    {gIdx > 0 && (
                      <div className="w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent shrink-0 self-stretch" />
                    )}
                    <div className="flex flex-col min-w-[120px]">
                    <Link
                      href={categoryUrl(hrefPrefix, group.slug)}
                      className="block px-2 py-1 mb-0.5 text-[11px] font-semibold text-gray-900 border-b border-gray-100 transition-colors hover:text-black"
                    >
                      {group.line}
                    </Link>
                    {group.items.length === 0 ? (
                      <div className="px-2 py-3 text-[11px] text-gray-300 text-center">{emptyText}</div>
                    ) : (
                      <div className="flex gap-1 mt-1">
                        {itemCols.map((col, ci) => (
                          <div key={ci} className="flex flex-col gap-[1px] flex-1 min-w-[90px]">
                            {col.map(renderNavCardItem)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-50 text-center">
              <Link
                href={listUrl(hrefPrefix)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-900 transition-colors"
              >
                {viewAllFor(hrefPrefix)} →
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderFlatListDropdown(moduleKey: string, moduleName: string, items: NavChild[], emptyText: string) {
    const list = items;
    return (
      <div className="bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-100 p-3 max-w-[80vw] min-w-[320px]">
        <Link
          href={listUrl(moduleKey)}
          className="block px-2 py-1 mb-0.5 text-[11px] font-semibold text-gray-900 border-b border-gray-100 transition-colors hover:text-black"
        >
          {moduleName}
        </Link>
        {list.length === 0 ? (
          <div className="px-2 py-6 text-[11px] text-gray-300 text-center">{emptyText}</div>
        ) : (
          <div className="flex flex-col gap-[1px] mt-1 max-h-[70vh] overflow-y-auto pr-1">
            {list.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                title={c.name}
                className="group/card block px-2 py-1.5 rounded-lg transition-all duration-200 hover:-translate-y-[3px] hover:shadow-sm hover:bg-gray-50/80"
              >
                <div className="text-xs font-medium text-gray-700 group-hover/card:text-gray-900 transition-colors duration-200 whitespace-nowrap overflow-hidden text-ellipsis">
                  {c.name}
                </div>
                {c.description && (
                  <div className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-1">
                    {c.description}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-gray-50 text-center">
          <Link
            href={listUrl(moduleKey)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-900 transition-colors"
          >
            {viewAllFor(moduleKey)} →
          </Link>
        </div>
      </div>
    );
  }

  function renderCasesDropdown() {
    const caseNav = navigation.find(n => n.key === 'cases');
    const children = caseNav?.children || [];
    return renderFlatListDropdown('cases', caseNav?.name || t('nav.cases'), children, t('nav.noCases'));
  }

  function renderDropdownPanel(item: NavItem) {
    if (item.key === 'products') {
      return renderCardDropdown(productGroups, t('nav.noProducts'), 'products', 'productLine');
    }
    if (item.key === 'solutions') {
      return renderCardDropdown(solutionGroups, t('nav.noSolutions'), 'solutions', 'industry');
    }
    if (item.key === 'cases') {
      return renderCasesDropdown();
    }
    if (item.key === 'resources') {
      return renderCardDropdown(resourceGroups, t('nav.noResources'), 'resources', 'category');
    }
    if (item.key && !BUILTIN_KEYS.includes(item.key)) {
      return item.moduleType === 2
        ? renderFlatListDropdown(item.key, item.name, genericItems[item.key] || [], t('nav.noContent'))
        : renderCardDropdown(genericGroups[item.key] || [], t('nav.noContent'), item.key, 'group');
    }
    return null;
  }

  function renderMobileGroupList(moduleKey: string, groups: NavGroup[], headerIsLink: boolean, itemKeyField: 'name' | 'href') {
    return (
      <div className="ml-4 pb-2 space-y-2 border-l-2 border-gray-100 pl-3">
        {groups.map((group) => (
          <div key={group.line}>
            {headerIsLink ? (
              <Link
                href={categoryUrl(moduleKey, group.slug)}
                className="block py-1.5 text-sm font-semibold text-gray-700 hover:text-black transition-colors"
                onClick={closeMobileMenu}
              >
                {group.line}
              </Link>
            ) : (
              <span className="block py-1.5 text-sm font-semibold text-gray-700">{group.line}</span>
            )}
            <div className="ml-3 space-y-0.5">
              {group.items.map((p) => (
                <Link
                  key={itemKeyField === 'name' ? p.name : p.href}
                  href={p.href}
                  className="block py-1 text-sm text-gray-500 hover:text-black transition-colors"
                  onClick={closeMobileMenu}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderMobileFlatList(items: NavChild[]) {
    return (
      <div className="ml-4 pb-2 space-y-2 border-l-2 border-gray-100 pl-3">
        {items.length === 0 ? (
          <div className="py-1.5 text-sm text-gray-400">{t('nav.noContent')}</div>
        ) : (
          items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block py-1 text-sm text-gray-500 hover:text-black transition-colors"
              onClick={closeMobileMenu}
            >
              {it.name}
            </Link>
          ))
        )}
      </div>
    );
  }

  function renderMobileSubmenu(item: NavItem): React.ReactNode {
    if (item.key === 'products') return renderMobileGroupList('products', productGroups, true, 'name');
    if (item.key === 'solutions') return renderMobileGroupList('solutions', solutionGroups, true, 'name');
    if (item.key === 'resources') return renderMobileGroupList('resources', resourceGroups, false, 'href');
    if (item.key && !BUILTIN_KEYS.includes(item.key)) {
      if (item.moduleType === 2) return renderMobileFlatList(genericItems[item.key] || []);
      return renderMobileGroupList(item.key, genericGroups[item.key] || [], true, 'href');
    }
    return null;
  }

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          scrolled
            ? 'bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm'
            : 'bg-white/0'
        )}
      >
        <nav className="max-w-[90rem] mx-auto px-6">
          <div className="flex justify-between items-center h-16 gap-4">
          <Link href="/" className="flex items-center shrink-0 transition-transform hover:scale-[1.02]">
            <img src={getImageUrl(siteConfig.logo) || '/logo.png'} alt={siteConfig.siteName || '示例科技'} className="h-12 w-auto" />
          </Link>

            <div className="hidden lg:flex items-center flex-1 min-w-0">
              <div
                className="flex items-center gap-1 flex-nowrap overflow-x-auto scrollbar-hide min-w-0 w-full"
                onScroll={handleNavScroll}
              >
                {navigation.map((item) => {
                  const hasDropdown = item.key !== undefined && item.key !== 'about';
                  const itemKey = item.key || item.name;
                  return (
                    <div
                      key={itemKey}
                      ref={(el) => { navItemRefs.current[itemKey] = el; }}
                      className="relative group shrink-0"
                      onMouseEnter={(e) => hasDropdown && handleNavEnter(itemKey, e)}
                      onMouseLeave={handleNavLeave}
                    >
                      <Link
                        href={item.href}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-black rounded-lg transition-all duration-200 flex items-center gap-1 whitespace-nowrap"
                      >
                        {navLabel(item)}
                        {hasDropdown && (
                          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180" />
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            {siteConfig.versionEnabled !== false && (
              <Link
                href="/version"
                className="group hidden xl:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap shrink-0"
              >
                <GitCompareArrows className="w-4 h-4" />
                <span className="hidden group-hover:inline">{t('nav.version')}</span>
              </Link>
            )}
            {opensourceLinks.length > 0 && (
              <div className="hidden xl:flex items-center gap-0.5 pl-1.5 ml-1 border-l border-gray-200/70 shrink-0">
                {opensourceLinks.map((l) => {
                  const Icon = l.option.icon;
                  return (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={l.label}
                      aria-label={l.label}
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:scale-105',
                        l.option.hover
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </a>
                  );
                })}
              </div>
            )}
            {user ? (
              <div className="relative shrink-0">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                >
                  <Avatar username={user.realName || user.username || t('common.guest')} avatar={user.avatar} size={28} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white/90 backdrop-blur-2xl rounded-xl shadow-lg border border-gray-200 py-1">
                    {isAdmin && (
                      <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setUserMenuOpen(false)}>
                        <LayoutDashboard className="w-3 h-3" /> {t('common.cms')}
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <LogOut className="w-3 h-3" /> {t('common.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap shrink-0"
              >
                {t('common.login')}
              </Link>
            )}
            <Link
              href="/about#contact"
              className="px-5 py-2 text-sm font-medium text-white bg-black rounded-full hover:bg-gray-800 transition-all duration-200 hover:shadow-lg whitespace-nowrap shrink-0"
            >
              {t('common.contact')}
            </Link>
          </div>

          <button
            type="button"
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100 animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
            {navigation.map((item) => (
              <div key={item.key || item.name}>
                <Link
                  href={item.href}
                  className="block py-3 text-gray-600 hover:text-black transition-colors font-medium"
                  onClick={closeMobileMenu}
                >
                  {navLabel(item)}
                </Link>
                {renderMobileSubmenu(item)}
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              {opensourceLinks.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2">
                  {opensourceLinks.map((l) => {
                    const Icon = l.option.icon;
                    return (
                      <a
                        key={l.label}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={l.label}
                        aria-label={l.label}
                        className={cn(
                          'flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:bg-gray-100 transition-colors',
                          l.option.hover
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </a>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              {user ? (
                <>
                  <div className="flex items-center justify-center py-3 text-gray-600">
                    <Avatar username={user.realName || user.username || t('common.guest')} avatar={user.avatar} size={28} />
                  </div>
                  {isAdmin && <Link href="/admin" className="block text-center py-3 text-gray-600 hover:text-black transition-colors" onClick={closeMobileMenu}>{t('common.admin')}</Link>}
                  <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full text-center py-3 text-gray-600 hover:text-black transition-colors">{t('common.logout')}</button>
                </>
              ) : (
                <Link href="/login" className="block text-center py-3 text-gray-600 hover:text-black transition-colors" onClick={closeMobileMenu}>{t('common.login')}</Link>
              )}
              <Link href="/about#contact" className="block text-center py-3 text-white bg-black rounded-full hover:bg-gray-800 transition-colors" onClick={closeMobileMenu}>{t('common.contact')}</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
    <div
      className={cn(
        'fixed inset-0 top-16 z-40 bg-black/[0.06] backdrop-blur-[3px] transition-opacity duration-300',
        hoveredNav ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-hidden="true"
    />
    {mounted && hoveredNav && hoverRect && (() => {
      const hoveredItem = navigation.find((n) => (n.key || n.name) === hoveredNav);
      if (!hoveredItem) return null;
      const hasDropdown = hoveredItem.key !== undefined && hoveredItem.key !== 'about';
      if (!hasDropdown) return null;
      const panel = renderDropdownPanel(hoveredItem);
      if (!panel) return null;
      return createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: panelLeft ?? hoverRect.left, top: hoverRect.top + 8, zIndex: 60 }}
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
          className="animate-slide-up"
        >
          {panel}
        </div>,
        document.body
      );
    })()}
  </>
);
}
