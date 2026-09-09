'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Role } from '@/types';
import { Plus, Pencil, Trash2, Shield, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ConfirmDialog';
import { useI18n } from '@/i18n/I18nProvider';

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const [editing, setEditing] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();
  const router = useRouter();

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const res = await adminApi.roles.list(); setRoles(res.data || []); } catch (err) { console.error(err); } finally { setLoading(false); } };

  const handleDelete = async (code: string) => {
    if (!(await confirm(t('admin.ui.roles.deleteConfirm')))) return;
    try { await adminApi.roles.delete(code); loadData(); } catch (err) { console.error(err); }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editing) await adminApi.roles.update(editing.code, formData);
      else await adminApi.roles.create(formData);
      setShowForm(false); setEditing(null); loadData();
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.roles')}</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">
          <Plus className="w-4 h-4" /> {t('admin.ui.roles.addRole')}
        </button>
      </div>

      {ConfirmDialog}
      {showForm && <RoleForm role={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.roles.colCode')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.roles.colName')}</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.roles.colDesc')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500">{t('admin.ui.roles.colUserCount')}</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((item) => (
              <tr key={item.code} className="border-b border-gray-100">
                <td className="py-3 px-4 font-mono text-xs text-gray-600">{item.code}</td>
                <td className="py-3 px-4 font-medium">{item.name}</td>
                <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{item.description}</td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 text-sm"><Users className="w-3.5 h-3.5 text-gray-400" />{item.userCount}</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1 text-gray-500 hover:text-black"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => router.push(`/admin/permissions?role=${item.code}`)} className="p-1 text-gray-500 hover:text-blue-600" title={t('admin.ui.roles.configPerm')}><Shield className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.code)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-400">{t('common.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleForm({ role, onSave, onCancel }: { role: Role | null; onSave: (data: any) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ code: role?.code || '', name: role?.name || '', description: role?.description || '', sortOrder: role?.sortOrder ?? 0 });
  const isEdit = !!role;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{isEdit ? t('admin.ui.roles.formEdit') : t('admin.ui.roles.formAdd')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.roles.formCode')}</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={isEdit} placeholder={t('admin.ui.roles.formCodePlaceholder')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 font-mono" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.roles.formName')}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.roles.formDesc')}</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.roles.formSort')}</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={() => onSave(isEdit ? { name: form.name, description: form.description, sortOrder: form.sortOrder } : form)} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{t('common.save')}</button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
      </div>
    </div>
  );
}
