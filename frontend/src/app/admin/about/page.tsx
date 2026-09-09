'use client';

import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { AboutSection } from '@/types';
import { Plus, Pencil, Trash2, Loader2, Phone, SaveAll, RefreshCw as RefreshCwIcon, AlertCircle, Check, GripVertical, Globe, MapPin, Mail, MessageCircle, Send, Headphones, Clock, Building2, QrCode } from 'lucide-react';
import Modal from '@/components/Modal';
import { useSyncProgress } from '@/hooks/useSyncProgress';
import { useI18n } from '@/i18n/I18nProvider';

import { useConfirm } from '@/components/ConfirmDialog';
import BlockForm from '@/components/BlockForm';
import api from '@/lib/api';

const typeLabelKeys: Record<string, string> = {
  list: 'admin.ui.sections.type.list',
  module: 'admin.ui.sections.type.module',
  image_text: 'admin.ui.sections.type.image_text',
  timeline: 'admin.ui.sections.type.timeline',
  rich_text: 'admin.ui.sections.type.rich_text',
  carousel: 'admin.ui.sections.type.carousel',
};

const CONTACT_ICONS: { name: string; Comp: any; labelKey: string }[] = [
  { name: 'Phone', Comp: Phone, labelKey: 'admin.ui.about.icon.phone' },
  { name: 'MapPin', Comp: MapPin, labelKey: 'admin.ui.about.icon.address' },
  { name: 'Mail', Comp: Mail, labelKey: 'admin.ui.about.icon.email' },
  { name: 'Globe', Comp: Globe, labelKey: 'admin.ui.about.icon.other' },
  { name: 'MessageCircle', Comp: MessageCircle, labelKey: 'admin.ui.about.icon.wechat' },
  { name: 'Send', Comp: Send, labelKey: 'admin.ui.about.icon.qq' },
  { name: 'Headphones', Comp: Headphones, labelKey: 'admin.ui.about.icon.service' },
  { name: 'Clock', Comp: Clock, labelKey: 'admin.ui.about.icon.time' },
  { name: 'Building2', Comp: Building2, labelKey: 'admin.ui.about.icon.company' },
  { name: 'QrCode', Comp: QrCode, labelKey: 'admin.ui.about.icon.qrcode' },
];

interface ContactRow {
  id?: number;
  type: string;
  icon: string;
  value: string;
}

function ContactIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = CONTACT_ICONS.find(i => i.name === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
          selected ? 'border-black bg-gray-50 text-gray-800' : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
        }`}
        title={selected ? t('admin.ui.about.iconSelected').replace('{label}', t(selected.labelKey)) : t('admin.ui.about.iconPickerTitle')}
      >
        {selected ? <selected.Comp className="w-4 h-4" /> : <span className="text-[10px]">{t('admin.ui.about.iconDefault')}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 w-52 p-2 bg-white border border-gray-200 rounded-lg shadow-lg grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`h-8 rounded flex items-center justify-center text-[10px] cursor-pointer ${!selected ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t('admin.ui.about.iconDefault')}
          </button>
          {CONTACT_ICONS.map(ic => (
            <button
              key={ic.name}
              type="button"
              title={t(ic.labelKey)}
              onClick={() => { onChange(ic.name); setOpen(false); }}
              className={`h-8 rounded flex items-center justify-center transition-colors cursor-pointer ${value === ic.name ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ic.Comp className="w-4 h-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactEditor({ contacts, onChange }: { contacts: ContactRow[]; onChange: (v: ContactRow[]) => void }) {
  const [newType, setNewType] = useState('');
  const { t } = useI18n();

  const updateContact = (i: number, field: 'type' | 'icon' | 'value', val: string) => {
    const next = [...contacts];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="min-w-[500px]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-semibold text-gray-900 w-16">{t('admin.ui.about.colIcon')}</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-900 w-28">{t('admin.ui.about.colType')}</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-900">{t('admin.ui.about.colValue')}</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-1.5 px-2">
                <ContactIconPicker value={c.icon || ''} onChange={(icon) => updateContact(i, 'icon', icon)} />
              </td>
              <td className="py-1.5 px-2">
                <input
                  value={c.type}
                  onChange={e => updateContact(i, 'type', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </td>
              <td className="py-1.5 px-2">
                <input
                  value={c.value}
                  onChange={e => updateContact(i, 'value', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </td>
              <td className="py-1.5 px-2">
                <button
                  onClick={() => onChange(contacts.filter((_, j) => j !== i))}
                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3">
        <input
          value={newType}
          onChange={e => setNewType(e.target.value)}
          placeholder={t('admin.ui.about.newTypePlaceholder')}
          className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
        />
        <button
          onClick={() => {
            const t_ = newType.trim();
            if (t_) {
              onChange([...contacts, { type: t_, icon: '', value: '' }]);
              setNewType('');
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
        >
          {t('admin.ui.about.addType')}
        </button>
      </div>
    </div>
  );
}

export default function AdminAbout() {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AboutSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { progress, syncing, startSync, stopSync } = useSyncProgress();
  const { confirm, ConfirmDialog } = useConfirm();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [savingContacts, setSavingContacts] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.aboutSections.list();
      setSections(res.data || []);
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.loadFail') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    adminApi.contacts.list().then(res => {
      if (res.data) setContacts((res.data as any[]).map(c => ({ id: c.id, type: c.type, icon: c.icon || '', value: c.value })));
    }).catch(() => {});
  }, []);

  const handleSave = async (formData: Partial<AboutSection>) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await adminApi.aboutSections.update(editing.id, formData);
        setMessage({ type: 'success', text: t('admin.ui.sections.updateSuccess') });
      } else {
        await adminApi.aboutSections.create(formData);
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

  const handleDelete = async (item: AboutSection) => {
    if (!(await confirm(t('admin.ui.sections.deleteConfirm').replace('{name}', item.title || '未命名')))) return;
    try {
      await adminApi.aboutSections.delete(item.id);
      setMessage({ type: 'success', text: t('common.deleteSuccess') });
      await load();
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.deleteFail') });
    }
  };

  const toggleStatus = async (item: AboutSection) => {
    const newStatus = item.status === 1 ? 0 : 1;
    setSections((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: newStatus } : r)));
    try {
      await adminApi.aboutSections.update(item.id, { title: item.title, sectionType: item.sectionType, status: newStatus });
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
      await adminApi.aboutSections.reorder(updated.map((s) => s.id));
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.sections.reorderFail') });
      await load();
    }
  };

  useEffect(() => () => stopSync(), [stopSync]);

  const handleSync = () => {
    startSync('about');
  };

  const handleSaveContacts = async () => {
    setSavingContacts(true);
    try {
      const existing = await adminApi.contacts.list();
      await Promise.all((existing.data || []).map(c => adminApi.contacts.delete(c.id)));
      await Promise.all(contacts.map(c =>
        adminApi.contacts.create({ type: c.type, value: c.value, icon: c.icon || undefined })
      ));
      setMessage({ type: 'success', text: t('admin.ui.about.contactsSaved') });
    } catch {
      setMessage({ type: 'error', text: t('admin.ui.about.contactsSaveFail') });
    } finally {
      setSavingContacts(false);
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
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.about')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.ui.about.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
            title={t('admin.ui.sections.syncTitle')}
          >
            {syncing ? <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
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
                  <span className="inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
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
              <Phone className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('admin.ui.about.contactsTitle')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('admin.ui.about.contactsDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleSaveContacts}
            disabled={savingContacts}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {savingContacts ? (
              <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SaveAll className="w-3.5 h-3.5" />
            )}
            {savingContacts ? t('common.saving') : t('common.save')}
          </button>
        </div>
        <div className="px-5 py-4">
          <ContactEditor contacts={contacts} onChange={setContacts} />
        </div>
      </div>
    </div>
  );
}
