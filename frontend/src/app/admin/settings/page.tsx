'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { SystemConfig } from '@/types';
import ImageUploader from '@/components/ImageUploader';
import { useI18n } from '@/i18n/I18nProvider';
import type { SiteOpenLink } from '@/hooks/useSiteConfig';
import { OPEN_ICON_OPTIONS, OPEN_ICON_MAP } from '@/lib/openSourceIcons';
import { encryptSecret, SECRET_MASK } from '@/lib/secretCrypto';
import {
  Palette, Check, Search, Sun, Moon,
  Monitor, Eye, EyeOff, ChevronDown, ChevronRight, ChevronUp, Settings2,
  RefreshCw, AlertCircle, Plus, Trash2,
  Layout, Globe,
  SaveAll
} from 'lucide-react';



interface SettingFieldProps {
  label?: string;
  description?: string;
  icon?: any;
  children: React.ReactNode;
}

function SettingField({ label, description, icon: Icon, children }: SettingFieldProps) {
  if (!label && !Icon && !description) {
    return <div className="py-4 px-5 first:pt-0 last:pb-0">{children}</div>;
  }
  return (
    <div className="flex items-start justify-between py-4 px-5 first:pt-0 last:pb-0 gap-6">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900 break-words">{label}</span>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        enabled ? 'bg-green-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="w-9 h-9 rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer"
          style={{ backgroundColor: value }}
        />
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
      />
    </div>
  );
}

function Select({
  value, options, onChange
}: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 cursor-pointer"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Input({ value, onChange, placeholder, type = 'text', autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
    />
  );
}

function OpenLinksManager({ links, iconOptions, onChange }: {
  links: SiteOpenLink[];
  iconOptions: { value: string; label: string }[];
  onChange: (links: SiteOpenLink[]) => void;
}) {
  const { t } = useI18n();
  const update = (idx: number, patch: Partial<SiteOpenLink>) =>
    onChange(links.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const remove = (idx: number) => onChange(links.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= links.length) return;
    const copy = [...links];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  };
  const add = () => onChange([...links, { label: '', url: '', icon: 'github', enabled: true }]);

  return (
    <div className="w-full space-y-2">
      {links.map((link, i) => {
        const opt = OPEN_ICON_MAP[link.icon || 'github'] || OPEN_ICON_OPTIONS[0];
        const PreviewIcon = opt.icon;
        return (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent" title={t('admin.ui.settings.openMoveUp')}>
                <ChevronUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === links.length - 1} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent" title={t('admin.ui.settings.openMoveDown')}>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <input
              value={link.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder={t('admin.ui.settings.openLabel')}
              className="flex-1 min-w-[6rem] px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
            />
            <input
              value={link.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://"
              className="flex-1 min-w-[10rem] px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
            />
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1 bg-white shrink-0">
              <PreviewIcon className="w-4 h-4 text-gray-500" />
              <select
                value={link.icon || 'github'}
                onChange={(e) => update(i, { icon: e.target.value })}
                className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {iconOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400">{t('admin.ui.settings.openEnabled')}</span>
              <ToggleSwitch enabled={link.enabled !== false} onChange={(v) => update(i, { enabled: v })} />
              <button
                type="button"
                onClick={() => remove(i)}
                title={t('admin.ui.settings.openDelete')}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> {t('admin.ui.settings.openAddLink')}
      </button>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-64 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 resize-y"
    />
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SectionCard({ title, description, icon: Icon, defaultOpen = true, children }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-4 border-t border-gray-100 divide-y divide-gray-50">{children}</div>}
    </div>
  );
}


function getInitialTheme(): 'light' | 'dark' | 'auto' {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('site_theme_mode');
    if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved;
  }
  return 'light';
}

function getInitialColor(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('site_primary_color') || '#000000';
  }
  return '#000000';
}

function applyBrandConfig(
  configValue: string,
  setBrand: React.Dispatch<React.SetStateAction<Record<string, any>>>,
) {
  const parsed = JSON.parse(configValue);
  if (!parsed.openLinks && (parsed.githubUrl || parsed.giteeUrl || parsed.docsUrl || parsed.pilotUrl)) {
    parsed.openLinks = [
      { label: 'GitHub', url: parsed.githubUrl || '', icon: parsed.githubIcon || 'github', enabled: true },
      { label: 'Gitee', url: parsed.giteeUrl || '', icon: parsed.giteeIcon || 'gitee', enabled: true },
      { label: 'Docs', url: parsed.docsUrl || '', icon: parsed.docsIcon || 'book', enabled: true },
      { label: 'Pilot', url: parsed.pilotUrl || '', icon: parsed.pilotIcon || 'rocket', enabled: true },
    ];
  }
  setBrand((prev) => ({ ...prev, ...parsed }));
}

function applySmsConfig(
  key: string,
  value: string,
  setSms: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setSmsSecretConfigured: React.Dispatch<React.SetStateAction<boolean>>,
) {
  if (key === 'sms_access_key_secret') {
    if (value === SECRET_MASK) {
      setSmsSecretConfigured(true);
      return;
    }
    setSms((prev) => ({ ...prev, sms_access_key_secret: value || '' }));
    return;
  }
  setSms((prev) => ({ ...prev, [key]: value }));
}

export default function AdminSettings() {
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { t } = useI18n();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [primaryColor, setPrimaryColor] = useState(getInitialColor);

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(getInitialTheme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const [aiUserRateLimit, setAiUserRateLimit] = useState(30);
  const [aiGuestDailyLimit, setAiGuestDailyLimit] = useState(5);

  const [brand, setBrand] = useState<Record<string, any>>({
    siteName: '示例科技',
    siteFullName: '示例科技有限公司',
    companyName: '示例科技有限公司',
    copyright: '示例科技有限公司 版权所有',
    contactPhone: '010-00000000',
    contactEmail: 'demo@example.com',
    icpNumber: 'ICP备案号待配置',
    logo: '/logo.png',
    favicon: '/logo-lable.png',
    openLinks: [
      { label: 'GitHub', url: '', icon: 'github', enabled: true },
      { label: 'Gitee', url: '', icon: 'gitee', enabled: true },
      { label: 'Docs', url: '', icon: 'book', enabled: true },
      { label: 'Pilot', url: '', icon: 'rocket', enabled: true },
    ],
  });

  const [sms, setSms] = useState<Record<string, string>>({
    sms_access_key_id: '',
    sms_access_key_secret: '',
    sms_sign_name: '',
    sms_template_code: '',
  });
  // 短信 Secret 是否已配置（配置后仅可覆盖修改，不回显旧值）
  const [smsSecretConfigured, setSmsSecretConfigured] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const applyTheme = (color: string) => {
    document.documentElement.style.setProperty('--primary-color', color);
    localStorage.setItem('site_primary_color', color);
  };



  useEffect(() => {
    adminApi.systemConfigs.list().then((res) => {
      const configs: SystemConfig[] = res?.data || [];
      let color = localStorage.getItem('site_primary_color') || '#000000';
      configs.forEach((c: SystemConfig) => {
        if (c.configKey === 'site_primary_color') { color = c.configValue; return; }
        if (c.configKey === 'site_brand') {
          try {
            applyBrandConfig(c.configValue, setBrand);
          } catch { /* ignore malformed */ }
          return;
        }
        if (c.configKey.startsWith('sms_')) {
          applySmsConfig(c.configKey, c.configValue, setSms, setSmsSecretConfigured);
          return;
        }
        if (c.configKey === 'theme_mode') setThemeMode(c.configValue as 'light' | 'dark' | 'auto');
        if (c.configKey === 'sidebar_collapsed') setSidebarCollapsed(c.configValue === 'true');
        if (c.configKey === 'animations_enabled') setAnimationsEnabled(c.configValue !== 'false');
        if (c.configKey === 'ai_user_rate_limit') {
          const v = Number(c.configValue);
          if (v > 0) setAiUserRateLimit(v);
        }
        if (c.configKey === 'ai_guest_daily_limit') {
          const v = Number(c.configValue);
          if (v > 0) setAiGuestDailyLimit(v);
        }
      });
      setPrimaryColor(color);
      applyTheme(color);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const apply = (isDark: boolean) => {
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('site_theme_mode', themeMode);
    };
    if (themeMode === 'dark') {
      apply(true);
    } else if (themeMode === 'light') {
      apply(false);
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themeMode]);

  const saveConfig = async (key: string, value: string) => {
    await adminApi.systemConfigs.save({
      configKey: key, configValue: value, configType: 'system', description: key,
    }).catch(() => { throw new Error(t('common.saveFail')); });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 短信 Secret 仅在填写新值时提交（RSA 加密）；留空表示保留原值
      const smsTasks: Promise<void>[] = [];
      for (const [k, v] of Object.entries(sms)) {
        if (k === 'sms_access_key_secret') {
          if (!v.trim()) continue;
          smsTasks.push(saveConfig(k, await encryptSecret(v)));
          continue;
        }
        smsTasks.push(saveConfig(k, v));
      }
      await Promise.all([
        saveConfig('site_primary_color', primaryColor),
        saveConfig('theme_mode', themeMode),
        saveConfig('sidebar_collapsed', String(sidebarCollapsed)),
        saveConfig('animations_enabled', String(animationsEnabled)),
        saveConfig('ai_user_rate_limit', String(Math.max(1, aiUserRateLimit))),
        saveConfig('ai_guest_daily_limit', String(Math.max(1, aiGuestDailyLimit))),
        saveConfig('site_brand', JSON.stringify(brand)),
        ...smsTasks,
      ]);
      if (smsTasks.length > 0) {
        setSmsSecretConfigured(true);
        setSms((p) => ({ ...p, sms_access_key_secret: '' }));
      }
      applyTheme(primaryColor);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('site-config-changed'));
      showToast(t('admin.ui.settings.allSaved'));
    } catch {
      showToast(t('admin.ui.settings.saveFail'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const iconOptions = useMemo(
    () => OPEN_ICON_OPTIONS.map((o) => ({ value: o.key, label: t(o.labelKey) })),
    [t]
  );

  const renderBrandLogo = useCallback(() => (
    <div className="flex items-center gap-3">
      <ImageUploader
        value={brand.logo}
        autoUpload
        uploadType="image"
        size="sm"
        objectFit="contain"
        onChange={(url) => setBrand((p) => ({ ...p, logo: url }))}
      />
    </div>
  ), [brand.logo]);

  const renderBrandFavicon = useCallback(() => (
    <div className="flex items-center gap-3">
      <ImageUploader
        value={brand.favicon}
        autoUpload
        uploadType="image"
        size="sm"
        objectFit="contain"
        onChange={(url) => setBrand((p) => ({ ...p, favicon: url }))}
      />
    </div>
  ), [brand.favicon]);

  const renderOpenLinks = useCallback(() => (
    <OpenLinksManager
      links={(brand.openLinks || []) as SiteOpenLink[]}
      iconOptions={iconOptions}
      onChange={(links) => setBrand((p) => ({ ...p, openLinks: links }))}
    />
  ), [brand.openLinks, iconOptions]);

  const renderSmsAccessKeyId = useCallback(() => (
    <Input value={sms.sms_access_key_id} onChange={(v) => setSms((p) => ({ ...p, sms_access_key_id: v }))} />
  ), [sms.sms_access_key_id]);

  const renderSmsAccessKeySecret = useCallback(() => (
    <Input
      type="password"
      autoComplete="off"
      value={smsSecretConfigured && !sms.sms_access_key_secret ? SECRET_MASK : sms.sms_access_key_secret}
      onChange={(v) => setSms((p) => ({ ...p, sms_access_key_secret: v }))}
      placeholder={smsSecretConfigured ? t('admin.ui.settings.smsSecretPlaceholder') : ''}
    />
  ), [smsSecretConfigured, sms.sms_access_key_secret, t]);

  const renderSmsSignName = useCallback(() => (
    <Input value={sms.sms_sign_name} onChange={(v) => setSms((p) => ({ ...p, sms_sign_name: v }))} />
  ), [sms.sms_sign_name]);

  const renderSmsTemplateCode = useCallback(() => (
    <Input value={sms.sms_template_code} onChange={(v) => setSms((p) => ({ ...p, sms_template_code: v }))} />
  ), [sms.sms_template_code]);

  const renderThemeMode = useCallback(() => (
    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
      {[
        { value: 'light', label: t('admin.ui.settings.themeLight'), icon: Sun },
        { value: 'dark', label: t('admin.ui.settings.themeDark'), icon: Moon },
        { value: 'auto', label: t('admin.ui.settings.themeAuto'), icon: Monitor },
      ].map(mode => (
        <button
          key={mode.value}
          onClick={() => setThemeMode(mode.value as 'light' | 'dark' | 'auto')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            themeMode === mode.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <mode.icon className="w-3.5 h-3.5" />
          {mode.label}
        </button>
      ))}
    </div>
  ), [themeMode, t]);

  const settingSections = useMemo(() => [
    {
      key: 'brand',
      title: t('admin.ui.settings.brandTitle'),
      description: t('admin.ui.settings.brandDesc'),
      icon: Globe,
      defaultOpen: true,
      items: [
        {
          key: 'site_logo', label: t('admin.ui.settings.brandLogo'), icon: Globe,
          description: t('admin.ui.settings.brandLogoDesc'),
          render: renderBrandLogo,
        },
        {
          key: 'site_favicon', label: t('admin.ui.settings.brandFavicon'), icon: Globe,
          description: t('admin.ui.settings.brandFaviconDesc'),
          render: renderBrandFavicon,
        },
      ],
    },
    {
      key: 'opensource',
      title: t('admin.ui.settings.openTitle'),
      icon: Globe,
      defaultOpen: false,
      items: [
        {
          key: 'open_links',
          render: renderOpenLinks,
        },
      ],
    },
    {
      key: 'sms',
      title: t('admin.ui.settings.smsTitle'),
      description: t('admin.ui.settings.smsDesc'),
      icon: Settings2,
      defaultOpen: false,
      items: [
        {
          key: 'sms_access_key_id', label: 'AccessKey ID', icon: Settings2,
          render: renderSmsAccessKeyId,
        },
        {
          key: 'sms_access_key_secret', label: 'AccessKey Secret', icon: Settings2,
          render: renderSmsAccessKeySecret,
        },
        {
          key: 'sms_sign_name', label: t('admin.ui.settings.smsSign'), icon: Settings2,
          render: renderSmsSignName,
        },
        {
          key: 'sms_template_code', label: t('admin.ui.settings.smsTemplate'), icon: Settings2,
          render: renderSmsTemplateCode,
        },
      ],
    },
    {
      key: 'appearance',
      title: t('admin.ui.settings.appearanceTitle'),
      description: t('admin.ui.settings.appearanceDesc'),
      icon: Palette,
      defaultOpen: true,
      items: [
        {
          key: 'primary_color', label: t('admin.ui.settings.primaryColor'), icon: Palette,
          render: () => <ColorPicker value={primaryColor} onChange={setPrimaryColor} />,
        },
        {
          key: 'theme_mode', label: t('admin.ui.settings.themeMode'), icon: themeMode === 'dark' ? Moon : Sun,
          render: renderThemeMode,
        },
        {
          key: 'animations_enabled', label: t('admin.ui.settings.animations'), icon: Layout,
          description: t('admin.ui.settings.animationsDesc'),
          render: () => <ToggleSwitch enabled={animationsEnabled} onChange={setAnimationsEnabled} />,
        },
      ],
    },
    {
      key: 'ai_advisor',
      title: t('admin.ui.settings.aiTitle'),
      description: t('admin.ui.settings.aiDesc'),
      icon: Settings2,
      defaultOpen: false,
      items: [
        {
          key: 'ai_user_rate_limit', label: t('admin.ui.settings.aiUserRate'), icon: Settings2,
          description: t('admin.ui.settings.aiUserRateDesc'),
          render: () => (
            <Input
              type="number"
              value={String(aiUserRateLimit)}
              onChange={v => { const n = Number(v); setAiUserRateLimit(Number.isFinite(n) && n > 0 ? n : 1); }}
            />
          ),
        },
        {
          key: 'ai_guest_daily_limit', label: t('admin.ui.settings.aiGuestDaily'), icon: Settings2,
          description: t('admin.ui.settings.aiGuestDailyDesc'),
          render: () => (
            <Input
              type="number"
              value={String(aiGuestDailyLimit)}
              onChange={v => { const n = Number(v); setAiGuestDailyLimit(Number.isFinite(n) && n > 0 ? n : 1); }}
            />
          ),
        },
      ],
    },
  ] as const, [t, primaryColor, themeMode, animationsEnabled, aiUserRateLimit, aiGuestDailyLimit, brand, sms, iconOptions, renderBrandLogo, renderBrandFavicon, renderOpenLinks, renderSmsAccessKeyId, renderSmsAccessKeySecret, renderSmsSignName, renderSmsTemplateCode, renderThemeMode]);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return settingSections;
    const q = searchQuery.toLowerCase();
    return settingSections
      .map(s => ({
        ...s,
          items: s.items.filter(i =>
            ('label' in i && i.label && i.label.toLowerCase().includes(q)) ||
          (s.title.toLowerCase().includes(q)) ||
          ('description' in s && s.description && s.description.toLowerCase().includes(q))
        ),
      }))
      .filter(s => s.items.length > 0);
  }, [searchQuery, settingSections]);

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent mb-4" />
        <p className="text-sm text-gray-500">{t('admin.ui.settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Settings2 className="w-6 h-6" />
            {t('admin.page.settings')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <SaveAll className="w-4 h-4" />
          )}
          {saving ? t('common.saving') : t('common.saveAll')}
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('admin.ui.settings.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchQuery && filteredSections.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.ui.settings.noMatch').replace('{q}', searchQuery)}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredSections.map(section => (
            <SectionCard
              key={section.key}
              title={section.title}
              description={'description' in section ? section.description : undefined}
              icon={section.icon}
              defaultOpen={section.defaultOpen ?? true}
            >
              {section.items.map(item => (
                <SettingField
                  key={item.key}
                  label={'label' in item ? item.label : undefined}
                  icon={'icon' in item ? item.icon : undefined}
                  description={'description' in item ? (item as any).description : undefined}
                >
                  {item.render()}
                </SettingField>
              ))}
            </SectionCard>
          ))}
        </div>
      )}


    </div>
  );
}
