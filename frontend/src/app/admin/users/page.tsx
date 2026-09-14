'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { User, PageResult, Role } from '@/types';
import { Plus, Pencil, Trash2, Search, KeyRound, AlertCircle } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/hooks/useAuth';

export default function AdminUsers() {
  const [data, setData] = useState<PageResult<User> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [page]);
  useEffect(() => { adminApi.roles.list().then(res => setRoles(res.data || [])).catch(() => {}); }, []);
  const loadData = async () => { setLoading(true); try { const res = await adminApi.users.list({ page, size: 10, keyword: keyword || undefined, role: roleFilter || undefined }); setData(res.data); } catch (err) { console.error(err); } finally { setLoading(false); } };
  const handleDelete = async (id: number) => { if (!(await confirm(t('admin.ui.users.deleteConfirm')))) return; try { await adminApi.users.delete(id); loadData(); } catch (err) { console.error(err); } };
  const [saveError, setSaveError] = useState('');
  const handleSave = async (formData: any) => { setSaveError(''); try { if (editing?.id) await adminApi.users.update(editing.id, formData); else await adminApi.users.create(formData); setShowForm(false); setEditing(null); setSaveError(''); loadData(); } catch (err: any) { setSaveError(err?.message || (err?.response?.data?.message || t('admin.ui.users.saveFail'))); console.error(err); } };
  const handleResetPassword = async () => { if (!showResetPwd || !newPassword) return; try { await adminApi.users.resetPassword(showResetPwd.id, newPassword); setShowResetPwd(null); setNewPassword(''); alert(t('admin.ui.users.resetSuccess')); } catch (err) { console.error(err); } };
  const handleToggleStatus = async (item: User) => { try { await adminApi.users.toggleStatus(item.id); loadData(); } catch (err) { console.error(err); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-gray-900">{t('admin.page.users')}</h1>{isSuperAdmin && <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"><Plus className="w-4 h-4" /> {t('admin.ui.users.addUser')}</button>}</div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadData()} placeholder={t('admin.ui.users.searchPlaceholder')} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm"><option value="">{t('admin.ui.users.allRoles')}</option>{roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
        <button onClick={loadData} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.search')}</button>
      </div>

      {ConfirmDialog}
      {showForm && <UserForm user={editing} roles={roles} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); setSaveError(''); }} error={saveError} disableRole={editing?.role === 'SUPER_ADMIN' && editing.username === user?.username} />}

      {showResetPwd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('admin.ui.users.resetPwdTitle').replace('{name}', showResetPwd.username)}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.newPassword')}</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
            <button onClick={handleResetPassword} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{t('admin.ui.users.confirmReset')}</button>
            <button onClick={() => { setShowResetPwd(null); setNewPassword(''); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.users.colUsername')}</th><th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.users.colRealName')}</th><th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.users.colEmail')}</th><th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.users.colRole')}</th><th className="text-center py-3 px-4 font-medium text-gray-500">{t('admin.ui.sections.colStatus')}</th><th className="text-center py-3 px-4 font-medium text-gray-500">{t('common.actions')}</th></tr></thead>
          <tbody>
            {data?.records?.map((item) => {
              const isSuperAdminRow = item.role === 'SUPER_ADMIN';
              const isSelf = isSuperAdminRow && item.username === user?.username;
              const isOtherSuperAdmin = isSuperAdminRow && !isSelf;
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">{item.username}</td>
                  <td className="py-3 px-4 text-gray-500">{item.realName}</td>
                  <td className="py-3 px-4 text-gray-500">{item.email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{roles.find(r => r.code === item.role)?.name || item.role}</span></td>
                  <td className="py-3 px-4 text-center">
                    {isSuperAdminRow || !isSuperAdmin ? (
                      <span className="text-xs text-gray-300">-</span>
                    ) : (
                      <button onClick={() => handleToggleStatus(item)} className={`px-2 py-0.5 rounded text-xs cursor-pointer ${item.status === 1 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>{item.status === 1 ? t('common.enable') : t('common.disable')}</button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isSuperAdmin && !isOtherSuperAdmin && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1 text-gray-500 hover:text-black"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setShowResetPwd(item); setNewPassword(''); }} className="p-1 text-gray-500 hover:text-orange-600"><KeyRound className="w-4 h-4" /></button>
                        {!isSuperAdminRow && <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    )}
                    {isSuperAdmin && isOtherSuperAdmin && <span className="text-xs text-gray-300">-</span>}
                  </td>
                </tr>
              );
            })}
            {(!data?.records || data.records.length === 0) && <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t('common.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && <div className="flex justify-center gap-2 mt-4">{Array.from({ length: data.pages }, (_, i) => (<button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-black text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>{i + 1}</button>))}</div>}
    </div>
  );
}

function UserForm({ user, roles, onSave, onCancel, error, disableRole }: { user: User | null; roles: Role[]; onSave: (data: any) => void; onCancel: () => void; error?: string; disableRole?: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ username: user?.username || '', password: '', email: user?.email || '', phone: user?.phone || '', realName: user?.realName || '', role: user?.role || 'NORMAL_USER' });
  const isEdit = !!user?.id;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{isEdit ? t('admin.ui.users.formEdit') : t('admin.ui.users.formAdd')}</h3>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formUsername')}</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={isEdit} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50" /></div>
        {!isEdit && <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formPassword')}</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formRealName')}</label><input value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formEmail')}</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formPhone')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.users.formRole')}</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={disableRole} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50">{roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></div>
      </div>
      <div className="flex gap-3 mt-4"><button onClick={() => onSave(isEdit ? { email: form.email, phone: form.phone, realName: form.realName, ...(disableRole ? {} : { role: form.role }) } : form)} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{t('common.save')}</button><button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button></div>
    </div>
  );
}
