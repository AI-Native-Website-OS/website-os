'use client';

import { useEffect } from 'react';
import api from '@/lib/api';

export interface ThemeConfig {
  themeMode: 'light' | 'dark' | 'auto';
  primaryColor: string;
}

function applyTheme(theme: ThemeConfig | null | undefined) {
  if (!theme) return;
  if (theme.themeMode) {
    const dark =
      theme.themeMode === 'dark' ||
      (theme.themeMode === 'auto' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }
  if (theme.primaryColor) {
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
  }
}

/**
 * 全局主题同步：挂载时从后端拉取 theme_mode / site_primary_color 并应用到根节点；
 * 监听 site-config-changed 事件（管理后台保存后派发）重新拉取，实现会话内实时更新。
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const load = () => {
      api
        .get<any, { data?: ThemeConfig }>('/home/theme')
        .then((res) => applyTheme(res?.data))
        .catch(() => {});
    };
    load();
    window.addEventListener('site-config-changed', load);
    return () => window.removeEventListener('site-config-changed', load);
  }, []);

  return <>{children}</>;
}