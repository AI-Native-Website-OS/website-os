'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Package, Lightbulb, FileText, BookOpen,
  Users, Search, Bot, Settings, LogOut, Menu, X,
  FileCheck, ChevronDown, HelpCircle, Shield,
  Database, MessageSquare, Terminal,
  Sliders, Ban, UserCog, KeyRound,
  Home, Info, Megaphone
} from 'lucide-react';
import { cn, getImageUrl } from '@/lib/utils';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import Avatar from '@/components/Avatar';
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { adminApi } from '@/lib/adminApi';
import { useI18n } from '@/i18n/I18nProvider';
import type { CoreModule } from '@/types';

const BUILTIN_KEYS = ['products', 'solutions', 'cases', 'resources'];

interface NavLink {
  name: string;
  i18nKey: string;
  href: string;
  icon: any;
  permission: string | null;
}

type NavItem =
  | { type: 'link'; name: string; i18nKey: string; icon: any; permission: string | null; href: string }
  | { type: 'group'; name: string; i18nKey: string; icon: any; permission: null; children: NavLink[] };

const menuTemplate: NavItem[] = [
  { type: 'link', name: '总览仪表盘', i18nKey: 'admin.dashboard', href: '/admin', icon: LayoutDashboard, permission: 'stats:view' },
  {
    type: 'group',
    name: '内容管理',
    i18nKey: 'admin.content',
    icon: FileText,
    permission: null,
    children: [
      { name: '首页管理', i18nKey: 'admin.homeManage', href: '/admin/home', icon: Home, permission: 'home_section:view' },
      { name: '关于管理', i18nKey: 'admin.aboutManage', href: '/admin/about', icon: Info, permission: 'about_section:view' },
      { name: '核心模块管理', i18nKey: 'admin.modulesManage', href: '/admin/modules', icon: Database, permission: 'core_module:view' },
      { name: '产品管理', i18nKey: 'admin.productManage', href: '/admin/content?module=products', icon: Package, permission: 'core_module:view' },
      { name: '方案管理', i18nKey: 'admin.solutionManage', href: '/admin/content?module=solutions', icon: Lightbulb, permission: 'core_module:view' },
      { name: '案例管理', i18nKey: 'admin.caseManage', href: '/admin/content?module=cases', icon: FileCheck, permission: 'core_module:view' },
      { name: '资源管理', i18nKey: 'admin.resourceManage', href: '/admin/content?module=resources', icon: BookOpen, permission: 'core_module:view' },
      { name: 'FAQ管理', i18nKey: 'admin.faqManage', href: '/admin/faqs', icon: HelpCircle, permission: 'page:config:view' },
      { name: '版本管理', i18nKey: 'admin.versionManage', href: '/admin/ai-website', icon: FileCheck, permission: 'page:config:view' },
    ],
  },
  {
    type: 'group',
    name: 'AI管理',
    i18nKey: 'admin.aiManage',
    icon: Bot,
    permission: null,
    children: [
      { name: '知识库管理', i18nKey: 'admin.knowledgeBase', href: '/admin/ai/knowledge', icon: BookOpen, permission: 'ai:knowledge:view' },
      { name: '记忆系统', i18nKey: 'admin.memorySystem', href: '/admin/ai/memory', icon: Database, permission: 'ai:knowledge:view' },
      { name: '对话记录', i18nKey: 'admin.chatRecords', href: '/admin/ai/chats', icon: MessageSquare, permission: 'ai:chat:view' },
      { name: '提示词配置', i18nKey: 'admin.promptConfig', href: '/admin/ai/prompts', icon: Terminal, permission: 'ai:config:edit' },
      { name: '模型参数配置', i18nKey: 'admin.modelConfig', href: '/admin/ai/model-config', icon: Sliders, permission: 'ai:config:edit' },
    ],
  },
  {
    type: 'group',
    name: '线索与推广',
    i18nKey: 'admin.leadMarketing',
    icon: Megaphone,
    permission: null,
    children: [
      { name: '线索管理', i18nKey: 'admin.leadManage', href: '/admin/leads', icon: Users, permission: 'lead:view' },
      { name: 'SEO/GEO配置', i18nKey: 'admin.seoConfig', href: '/admin/seo', icon: FileText, permission: 'seo:view' },
    ],
  },
  {
    type: 'group',
    name: '系统',
    i18nKey: 'admin.system',
    icon: Settings,
    permission: null,
    children: [
      { name: '账号管理', i18nKey: 'admin.accountManage', href: '/admin/users', icon: UserCog, permission: 'user:view' },
      { name: '角色管理', i18nKey: 'admin.roleManage', href: '/admin/roles', icon: Shield, permission: 'user:view' },
      { name: '权限管理', i18nKey: 'admin.permissionManage', href: '/admin/permissions', icon: KeyRound, permission: 'user:view' },
      { name: '系统配置', i18nKey: 'admin.systemConfig', href: '/admin/settings', icon: Sliders, permission: 'user:view' },
      { name: '接口文档', i18nKey: 'admin.apiDocs', href: '/admin/api-docs', icon: Terminal, permission: 'system:api-docs:view' },
    ],
  },
];

function isActiveLink(href: string, pathname: string, moduleParam: string | null): boolean {
  if (href.startsWith('/admin/content?module=')) {
    const key = href.split('module=')[1];
    return pathname === '/admin/content' && moduleParam === key;
  }
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

/** 从「/admin/content?module=<key>」形式的子项 href 中提取模块 key,非内容模块链接返回 null */
function moduleKeyOf(href: string): string | null {
  if (!href.startsWith('/admin/content?module=')) return null;
  return href.split('module=')[1] || null;
}

function splitModules(modules: CoreModule[]) {
  const custom = modules.filter(
    (m) => !BUILTIN_KEYS.includes(m.moduleKey) && m.status === 1
  );
  const enabledBuiltinKeys = modules
    .filter((m) => BUILTIN_KEYS.includes(m.moduleKey) && m.status === 1)
    .map((m) => m.moduleKey);
  return { custom, enabledBuiltinKeys };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module');
  const { user, logout, hasPermission, loading } = useAuth();
  const { t } = useI18n();
  const { siteConfig } = useSiteConfig();
  const [customModules, setCustomModules] = useState<CoreModule[]>([]);
  const [enabledBuiltinKeys, setEnabledBuiltinKeys] = useState<string[]>([]);

  useEffect(() => {
    const fetchModules = () => {
      adminApi.coreModules.all()
        .then((res: any) => {
          const modules: CoreModule[] = res.data || [];
          const { custom, enabledBuiltinKeys } = splitModules(modules);
          setCustomModules(custom);
          setEnabledBuiltinKeys(enabledBuiltinKeys);
        })
        .catch(() => {});
    };
    fetchModules();
    window.addEventListener('core-modules-changed', fetchModules);
    return () => window.removeEventListener('core-modules-changed', fetchModules);
  }, []);

  const menuItems = useMemo(() => {
    const items: NavItem[] = menuTemplate.map((item) =>
      item.type === 'group'
        ? {
            ...item,
            name: t(item.i18nKey),
            children: item.children.filter((c) => {
              const moduleKey = moduleKeyOf(c.href);
              if (moduleKey && BUILTIN_KEYS.includes(moduleKey)) {
                return enabledBuiltinKeys.includes(moduleKey);
              }
              return true;
            }).map((c) => ({ ...c, name: t(c.i18nKey) })),
          }
        : { ...item, name: t(item.i18nKey) }
    );
    if (customModules.length > 0) {
      const group = items.find((i) => i.type === 'group' && i.i18nKey === 'admin.content');
      if (group && group.type === 'group') {
        const idx = group.children.findIndex((c) => c.i18nKey === 'admin.modulesManage');
        const links: NavLink[] = customModules.map((m) => ({
          name: m.moduleName || m.moduleKey,
          i18nKey: '',
          href: `/admin/content?module=${m.moduleKey}`,
          icon: FileText,
          permission: 'core_module:view',
        }));
        group.children.splice(idx + 1, 0, ...links);
      }
    }
    return items;
  }, [customModules, enabledBuiltinKeys, t]);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    for (const item of menuItems) {
      if (item.type === 'group') {
        for (const child of item.children) {
          if (isActiveLink(child.href, pathname, moduleParam)) return item.name;
        }
      }
    }
    const firstGroup = menuItems.find(i => i.type === 'group');
    return firstGroup ? firstGroup.name : null;
  });

  useEffect(() => {
    for (const item of menuItems) {
      if (item.type === 'group') {
        for (const child of item.children) {
          if (isActiveLink(child.href, pathname, moduleParam)) {
            setExpandedGroup(item.name);
            return;
          }
        }
      }
    }
  }, [pathname, moduleParam, menuItems]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroup(prev => prev === groupName ? null : groupName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-5 w-5 border-[1.5px] border-gray-300 border-t-gray-900"></div>
        </div>
        <div className="lg:pl-60">
          <main className="px-6 pt-5 pb-8">{children}</main>
        </div>
      </div>
    );
  }

  if (!user) {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.userType === 'INTERNAL') {
          return (
            <div className="min-h-screen flex items-center justify-center bg-white">
              <div className="animate-spin rounded-full h-5 w-5 border-[1.5px] border-gray-300 border-t-gray-900"></div>
            </div>
          );
        }
      } catch { /* ignore */ }
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.noPermission')}</h1>
          <p className="text-sm text-gray-500 mb-4">{t('admin.noPermissionDesc')}</p>
          <Link href="/" className="text-sm text-gray-900 underline underline-offset-2">{t('admin.backHome')}</Link>
        </div>
      </div>
    );
  }

  if (user.userType !== 'INTERNAL') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.noPermission')}</h1>
          <p className="text-sm text-gray-500 mb-4">{t('admin.noPermissionDesc')}</p>
          <Link href="/" className="text-sm text-gray-900 underline underline-offset-2">{t('admin.backHome')}</Link>
        </div>
      </div>
    );
  }

  const filteredItems: NavItem[] = menuItems
    .map(item => {
      if (item.type === 'group') {
        return {
          ...item,
          children: item.children.filter(
            child =>
              (!child.permission || hasPermission(child.permission) || user.role === 'SUPER_ADMIN') &&
              !(child.i18nKey === 'admin.versionManage' && siteConfig.versionEnabled === false)
          ),
        };
      }
      return item;
    })
    .filter(item => {
      if (item.type === 'group') return item.children.length > 0;
      return !item.permission || hasPermission(item.permission) || user.role === 'SUPER_ADMIN';
    });

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className={cn('fixed inset-0 z-40 lg:hidden', sidebarOpen ? 'block' : 'hidden')}>
        <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
      </div>

      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-gray-100 transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-14 px-5 border-b border-gray-100">
          <Link href="/" className="flex items-center">
            <img src={getImageUrl(siteConfig.logo) || '/logo.png'} alt={siteConfig.siteName || '圣诺联合'} className="h-9 w-auto" />
          </Link>
          <button className="lg:hidden -mr-1 p-1 rounded hover:bg-gray-100 transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100vh-7rem)]">
          {filteredItems.map((item) => {
            if (item.type === 'link') {
              const isActive = isActiveLink(item.href, pathname, moduleParam);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'text-gray-900 bg-gray-100'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  )}
                >
                  <item.icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.5} />
                  {item.name}
                </Link>
              );
            }
            const isExpanded = expandedGroup === item.name;
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleGroup(item.name)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 w-full transition-all duration-150"
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.5} />
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-150', isExpanded && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="submenu"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-0.5 space-y-0.5 pb-0.5 border-l border-gray-100 pl-3">
                        {item.children.map((child) => {
                          const isActive = isActiveLink(child.href, pathname, moduleParam);
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                'flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium transition-all duration-150',
                                isActive
                                  ? 'text-gray-900'
                                  : 'text-gray-500 hover:text-gray-800'
                              )}
                            >
                              <child.icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2 : 1.5} />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 h-14 bg-[#fafafa] border-b border-gray-100 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden -ml-1 p-1.5 rounded hover:bg-gray-100 transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4 text-gray-500" />
            </button>
            <div className="hidden lg:flex items-center">
              <span className="text-xs text-gray-300 select-none">/</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <NotificationBell />
            <div className="relative group">
              <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                <Avatar username={user.realName || user.username || t('common.guest')} avatar={user.avatar} size={28} />
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-gray-100 rounded-lg shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="px-3.5 py-2.5 border-b border-gray-50">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.realName || user.username || t('common.guest')}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user.email || user.phone || ''}</p>
                </div>
                <div className="p-1">
                  <Link href="/admin" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    {t('admin.dashboard')}
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
                    <LogOut className="w-3.5 h-3.5" />
                    {t('common.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 pt-5 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
