'use client';

import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { HomeSection, FooterConfig } from '@/types';
import { Plus, Pencil, Trash2, GripVertical, Globe, RefreshCw, Copyright, SaveAll } from 'lucide-react';
import { useSyncProgress } from '@/hooks/useSyncProgress';
import { useI18n } from '@/i18n/I18nProvider';

import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmDialog';
import BlockForm from '@/components/BlockForm';
import ImageUploader from '@/components/ImageUploader';

const typeLabelKeys: Record<string, string> = {
  list: 'admin.ui.sections.type.list',
  module: 'admin.ui.sections.type.module',
  image_text: 'admin.ui.sections.type.image_text',
  timeline: 'admin.ui.sections.type.timeline',
  rich_text: 'admin.ui.sections.type.rich_text',
  carousel: 'admin.ui.sections.type.carousel',
};

const defaultFooter: FooterConfig = {
  logo: '',
  copyright: '',
  policeIcon: '',
  icpNumber: '',
  icpUrl: '',
  policeNumber: '',
  policeUrl: '',
  extra: [
    { label: '公司名称', value: '' },
    { label: '公司地址', value: '' },
    { label: '联系电话', value: '' },
    { label: '邮箱', value: '' },
  ],
};

const fieldCls =
  'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400';

function FooterEditor({ config, onChange }: { config: FooterConfig; onChange: (v: FooterConfig) => void }) {
  const { t } = useI18n();
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const set = (patch: Partial<FooterConfig>) => onChange({ ...config, ...patch });

  const addExtra = () => {
    const label = newLabel.trim();
    const value = newValue.trim();
    if (label || value) {
      set({ extra: [...config.extra, { label, value }] });
      setNewLabel('');
      setNewValue('');
    }
  };

  const updateExtra = (i: number, field: 'label' | 'value', val: string) => {
    set({ extra: config.extra.map((it, j) => (j === i ? { ...it, [field]: val } : it)) });
  };

  const removeExtra = (i: number) => set({ extra: config.extra.filter((_, j) => j !== i) });

  return (
    <div className="grid gap-4">
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-gray-900">{t('admin.ui.homeFooter.copyrightTitle')}</span>
          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px]">{t('admin.ui.homeFooter.fixedItems')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-6 gap-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.logo')}</label>
            <ImageUploader value={config.logo} onChange={(url) => set({ logo: url })} autoUpload uploadType="image" subPath="footer" size="sm" objectFit="contain" />
          </div>
          <div className="grid gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.copyrightLabel')}</label>
              <input value={config.copyright} onChange={(e) => set({ copyright: e.target.value })} className={fieldCls} placeholder={t('admin.ui.homeFooter.copyrightPlaceholder')} maxLength={200} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.policeIcon')}</label>
            <ImageUploader value={config.policeIcon} onChange={(url) => set({ policeIcon: url })} autoUpload uploadType="image" subPath="footer" size="sm" objectFit="contain" fallbackSrc="/police.png" />
          </div>
          <div className="grid gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.policeNumber')}</label>
              <input value={config.policeNumber} onChange={(e) => set({ policeNumber: e.target.value })} className={fieldCls} placeholder={t('admin.ui.homeFooter.policeNumberPlaceholder')} maxLength={100} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.policeUrl')}</label>
              <input value={config.policeUrl} onChange={(e) => set({ policeUrl: e.target.value })} className={fieldCls} placeholder="https://..." maxLength={500} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.icpNumber')}</label>
              <input value={config.icpNumber} onChange={(e) => set({ icpNumber: e.target.value })} className={fieldCls} placeholder={t('admin.ui.homeFooter.icpNumberPlaceholder')} maxLength={100} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.icpUrl')}</label>
              <input value={config.icpUrl} onChange={(e) => set({ icpUrl: e.target.value })} className={fieldCls} placeholder="https://..." maxLength={500} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.ui.homeFooter.otherFooter')}</label>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 font-semibold text-gray-900 w-40">{t('admin.ui.homeFooter.colLabel')}</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-900">{t('admin.ui.homeFooter.colValue')}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {config.extra.map((it, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 px-3">
                    <input
                      value={it.label}
                      onChange={(e) => updateExtra(i, 'label', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                      maxLength={50}
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      value={it.value}
                      onChange={(e) => updateExtra(i, 'value', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                      maxLength={200}
                    />
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <button onClick={() => removeExtra(i)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title={t('common.delete')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {config.extra.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">{t('admin.ui.homeFooter.noOther')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t('admin.ui.homeFooter.labelPlaceholder')} className="w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400" maxLength={50} />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={t('admin.ui.homeFooter.valuePlaceholder')} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400" maxLength={200} />
          <button onClick={addExtra} className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
            {t('admin.ui.homeFooter.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [saving, setSaving] = useState(false);
  const { progress, syncing, startSync, stopSync } = useSyncProgress();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [footerConfig, setFooterConfig] = useState<FooterConfig>(defaultFooter);
  const [footerLoading, setFooterLoading] = useState(true);
  const [savingFooter, setSavingFooter] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.homeSections.list();
      setSections(res.data || []);
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.loadFail') });
    } finally {
      setLoading(false);
    }
  };

  const loadFooter = async () => {
    setFooterLoading(true);
    try {
      const res = await adminApi.homeFooter.get();
      if (res.data?.configValue) {
        const parsed = JSON.parse(res.data.configValue);
        const extra = [...(parsed.extra || [])];
        const legacy: Array<{ label: string; key: string }> = [
          { label: '公司名称', key: 'companyName' },
          { label: '公司地址', key: 'address' },
          { label: '联系电话', key: 'phone' },
          { label: '邮箱', key: 'email' },
        ];
        legacy.forEach(({ label, key }) => {
          if (parsed[key] && !extra.some((it: any) => it.label === label)) {
            extra.push({ label, value: parsed[key] });
          }
        });
        setFooterConfig({ ...defaultFooter, ...parsed, extra });
      }
    } catch {
      // 保持默认配置
    } finally {
      setFooterLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { loadFooter(); }, []);

  const handleSave = async (formData: Partial<HomeSection>) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await adminApi.homeSections.update(editing.id, formData);
        setMessage({ type: 'success', text: t('admin.ui.sections.updateSuccess') });
      } else {
        await adminApi.homeSections.create(formData);
        setMessage({ type: 'success', text: t('admin.ui.sections.createSuccess') });
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || t('admin.ui.sections.operationFail') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: HomeSection) => {
    if (!(await confirm(t('admin.ui.sections.deleteConfirm').replace('{name}', item.title || '未命名')))) return;
    try {
      await adminApi.homeSections.delete(item.id);
      setMessage({ type: 'success', text: t('common.deleteSuccess') });
      await load();
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.deleteFail') });
    }
  };

  useEffect(() => () => stopSync(), [stopSync]);

  const handleSync = () => {
    startSync('home');
  };

  const handleSaveFooter = async () => {
    const emailItem = footerConfig.extra.find((it) => it.label === '邮箱');
    if (emailItem?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailItem.value)) {
      setMessage({ type: 'error', text: t('admin.ui.home.emailInvalid') });
      return;
    }
    setSavingFooter(true);
    try {
      await adminApi.homeFooter.save(footerConfig);
      setMessage({ type: 'success', text: t('admin.ui.home.footerSaved') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || t('admin.ui.home.footerSaveFail') });
    } finally {
      setSavingFooter(false);
    }
  };

  const toggleStatus = async (item: HomeSection) => {
    const newStatus = item.status === 1 ? 0 : 1;
    setSections((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: newStatus } : r)));
    try {
      await adminApi.homeSections.update(item.id, { title: item.title, sectionType: item.sectionType, status: newStatus });
    } catch {
      setSections((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: item.status } : r)));
      setMessage({ type: 'error', text: t('admin.ui.sections.statusUpdateFail') });
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDrop = async () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const updated = [...sections];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSections(updated);
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await adminApi.homeSections.reorder(updated.map((s) => s.id));
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.reorderFail') });
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div>
      {ConfirmDialog}

      {message && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-100 cursor-pointer">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.home')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.home.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
            title={t('admin.ui.sections.syncTitle')}
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            {syncing ? t('common.syncing') : t('common.syncAll')}
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('admin.ui.sections.addSection')}
          </button>
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        title={editing ? t('admin.ui.sections.editSection') : t('admin.ui.sections.addSection')}
      >
        <BlockForm item={editing} saving={saving} onSave={handleSave} />
      </Modal>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-10">{t('admin.ui.sections.colOrder')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.sections.colType')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.sections.colTitle')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.sections.colSubtitle')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.sections.colCreatedAt')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-20">{t('admin.ui.sections.colStatus')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-24">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((item, index) => (
              <tr
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
                onDrop={handleDrop}
                onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                className={`border-b border-gray-100 hover:bg-gray-50/50 cursor-default ${dragItem.current === index ? 'opacity-50' : ''}`}
              >
                <td className="py-3 px-4 text-center">
                  <span
                    className="inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                    onMouseDown={(e) => { (e.currentTarget.closest('tr') as HTMLElement)?.setAttribute('draggable', 'true'); }}
                  >
                    <GripVertical className="w-4 h-4" />
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                    {typeLabelKeys[item.sectionType] ? t(typeLabelKeys[item.sectionType]) : item.sectionType}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium">{item.title || '-'}</td>
                <td className="py-3 px-4 text-gray-500 truncate max-w-[200px]">{item.subtitle || '-'}</td>
                <td className="py-3 px-4 text-gray-500 text-xs">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '-'}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleStatus(item)}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      item.status === 1
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item.status === 1 ? t('common.show') : t('common.hide')}
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setEditing(item);
                        setShowForm(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {t('admin.ui.sections.noSections')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Copyright className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('admin.ui.homeFooter.title')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('admin.ui.homeFooter.desc')}</p>
            </div>
          </div>
          <button
            onClick={handleSaveFooter}
            disabled={savingFooter}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingFooter ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SaveAll className="w-3.5 h-3.5" />
            )}
            {savingFooter ? t('common.saving') : t('common.save')}
          </button>
        </div>
        <div className="px-5 py-4">
          {footerLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black" />
            </div>
          ) : (
            <FooterEditor config={footerConfig} onChange={setFooterConfig} />
          )}
        </div>
      </div>
    </div>
  );
}
