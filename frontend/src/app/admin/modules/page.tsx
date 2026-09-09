'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { CoreModule } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import { Plus, Pencil, Trash2, GripVertical, Search, Loader2, RefreshCw, FileText } from 'lucide-react';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmDialog';

const typeLabelKeys: Record<number, string> = {
  1: 'admin.ui.modules.type1',
  2: 'admin.ui.modules.type2',
};

const builtinKeys = ['products', 'solutions', 'cases', 'resources'];

export default function AdminModules() {
  const [modules, setModules] = useState<CoreModule[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CoreModule | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const notifyModulesChanged = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('core-modules-changed'));
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.coreModules.all();
      setModules(res.data || []);
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.loadFail') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (formData: Partial<CoreModule>) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await adminApi.coreModules.update(editing.id, formData);
        setMessage({ type: 'success', text: t('admin.ui.sections.updateSuccess') });
      } else {
        await adminApi.coreModules.create(formData);
        setMessage({ type: 'success', text: t('admin.ui.sections.createSuccess') });
      }
      setShowForm(false);
      setEditing(null);
      await load();
      notifyModulesChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || t('admin.ui.sections.operationFail') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CoreModule) => {
    if (builtinKeys.includes(item.moduleKey)) {
      setMessage({ type: 'error', text: t('admin.ui.modules.deleteBuiltin') });
      return;
    }
    if (!(await confirm(t('admin.ui.modules.deleteConfirm').replace('{name}', item.moduleName || '未命名')))) return;
    try {
      await adminApi.coreModules.delete(item.id);
      setMessage({ type: 'success', text: t('common.deleteSuccess') });
      await load();
      notifyModulesChanged();
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.deleteFail') });
    }
  };

  const toggleStatus = async (item: CoreModule) => {
    const newStatus = item.status === 1 ? 0 : 1;
    setModules((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: newStatus } : r)));
    try {
      await adminApi.coreModules.update(item.id, {
        moduleKey: item.moduleKey,
        moduleName: item.moduleName,
        moduleType: item.moduleType,
        moduleColumns: item.moduleColumns,
        status: newStatus,
      });
      notifyModulesChanged();
    } catch {
      setModules((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: item.status } : r)));
      setMessage({ type: 'error', text: t('admin.ui.sections.statusUpdateFail') });
    }
  };

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragOver = (index: number) => { dragOverItem.current = index; };

  const handleDrop = async () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const updated = [...modules];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setModules(updated);
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await adminApi.coreModules.reorder(updated.map((s) => s.id));
      setMessage({ type: 'success', text: t('admin.ui.sections.updateSuccess') });
      notifyModulesChanged();
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.reorderFail') });
      await load();
    }
  };

  const filtered = keyword.trim()
    ? modules.filter((m) =>
        [m.moduleName, m.moduleTitle, m.moduleKey, m.path].some((v) => v && v.toLowerCase().includes(keyword.trim().toLowerCase()))
      )
    : modules;

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
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.modules')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.modules.subtitle')}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {t('admin.ui.modules.addModule')}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('admin.ui.modules.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button onClick={() => { setKeyword(''); load(); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? t('admin.ui.modules.editModule') : t('admin.ui.modules.addModule')}>
        <ModuleForm item={editing} saving={saving} onSave={handleSave} />
      </Modal>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-10">{t('admin.ui.modules.colOrder')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.modules.colName')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.modules.colTitle')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.modules.colDesc')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.modules.colKey')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 w-24">{t('admin.ui.modules.colType')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-16">{t('admin.ui.modules.colColumns')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-20">{t('admin.ui.sections.colStatus')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 w-24">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, index) => (
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
                  <span className="inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                    <GripVertical className="w-4 h-4" />
                  </span>
                </td>
                <td className="py-3 px-4 font-medium">{item.moduleName || '-'}</td>
                <td className="py-3 px-4 text-gray-700">{item.moduleTitle || '-'}</td>
                <td className="py-3 px-4 text-gray-500 truncate max-w-[220px]">{item.moduleDescription || '-'}</td>
                <td className="py-3 px-4 text-gray-500">
                  <span className="font-mono text-xs">{item.moduleKey}</span>
                  {builtinKeys.includes(item.moduleKey) && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">{t('admin.ui.modules.builtin')}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                    {typeLabelKeys[item.moduleType] ? t(typeLabelKeys[item.moduleType]) : item.moduleType}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-gray-700">{item.moduleColumns || 4}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleStatus(item)}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      item.status === 1
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item.status === 1 ? t('common.enable') : t('common.disable')}
                  </button>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {!builtinKeys.includes(item.moduleKey) && (
                      <Link
                        href={`/admin/content?module=${item.moduleKey}`}
                        title={t('admin.ui.modules.contentManage')}
                        className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                    )}
                    <button
                      onClick={() => { setEditing(item); setShowForm(true); }}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400">
                  {loading ? t('common.loading') : t('admin.ui.modules.noModules')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleForm({ item, saving, onSave }: { item: CoreModule | null; saving: boolean; onSave: (data: Partial<CoreModule>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    moduleName: item?.moduleName || '',
    moduleTitle: item?.moduleTitle || '',
    moduleDescription: item?.moduleDescription || '',
    moduleType: item?.moduleType || 1,
    moduleColumns: item?.moduleColumns || 4,
  });

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleSubmit = () => {
    onSave({
      moduleName: form.moduleName.trim(),
      moduleTitle: form.moduleTitle.trim(),
      moduleDescription: form.moduleDescription.trim(),
      moduleType: Number(form.moduleType),
      moduleColumns: Number(form.moduleColumns),
    });
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.modules.formNameLabel')}<span className="text-red-400">*</span></label>
          <input value={form.moduleName} onChange={(e) => update('moduleName', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder={t('admin.ui.modules.formNamePlaceholder')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.modules.formTitleLabel')}</label>
          <input value={form.moduleTitle} onChange={(e) => update('moduleTitle', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder={t('admin.ui.modules.formTitlePlaceholder')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.modules.formTypeLabel')}</label>
          <select value={form.moduleType} onChange={(e) => update('moduleType', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            <option value={1}>{t('admin.ui.modules.formTypeOption1')}</option>
            <option value={2}>{t('admin.ui.modules.formTypeOption2')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.modules.formColumnsLabel')}</label>
          <select value={form.moduleColumns} onChange={(e) => update('moduleColumns', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} 列</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{t('admin.ui.modules.formColumnsHint')}</p>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.modules.formDescLabel')}</label>
          <textarea value={form.moduleDescription} onChange={(e) => update('moduleDescription', e.target.value)} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder={t('admin.ui.modules.formDescPlaceholder')} />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">{t('admin.ui.modules.autoNote')}</p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSubmit}
          disabled={saving || !form.moduleName.trim()}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
