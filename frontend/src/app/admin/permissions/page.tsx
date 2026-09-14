'use client';

import { Suspense, useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Permission, Role } from '@/types';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/hooks/useAuth';

export default function AdminPermissions() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>}>
      <PermissionsContent />
    </Suspense>
  );
}

async function loadRolePermissions(role: Role) {
  const res = await adminApi.permissions.getByRole(role.code);
  return { role: role.code, ids: res.data?.map(p => p.id) || [] };
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400';
const labelCls = 'block text-xs text-gray-500 mb-1';

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

function PermManageModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Permission | null>(null);
  const [form, setForm] = useState({ code: '', name: '', module: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      adminApi.permissions.list().then((res) => setPermissions(res.data || [])).catch(() => setPermissions([]));
      setView('list');
      setEditing(null);
    }
  }, [open]);

  const startCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', module: '', description: '' });
    setView('form');
  };

  const startEdit = (p: Permission) => {
    setEditing(p);
    setForm({ code: p.code, name: p.name, module: p.module, description: p.description || '' });
    setView('form');
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.module.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await adminApi.permissions.update(editing.id, form);
      } else {
        await adminApi.permissions.create(form);
      }
      onSaved();
      setView('list');
      adminApi.permissions.list().then((res) => setPermissions(res.data || [])).catch(() => {});
    } catch {
      // 失败时保持表单打开，交由 onSaved 上层提示
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Permission) => {
    if (!window.confirm(t('admin.ui.permissions.deletePermConfirm'))) return;
    try {
      await adminApi.permissions.delete(p.id);
      onSaved();
      adminApi.permissions.list().then((res) => setPermissions(res.data || [])).catch(() => {});
    } catch {
      // 删除失败
    }
  };

  if (!open) return null;
  const modules = [...new Set(permissions.map(p => p.module))].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-xl p-6 shadow-xl max-h-[80vh] flex flex-col">
        {view === 'list' ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('admin.ui.permissions.managePermissions')}</h3>
              <div className="flex gap-2">
                <button onClick={startCreate} className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800">{t('admin.ui.permissions.addPermission')}</button>
                <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">{t('admin.ui.permissions.cancel')}</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {modules.map(module => (
                <div key={module}>
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">{module}</h4>
                  <div className="space-y-1.5">
                    {permissions.filter(p => p.module === module).map(p => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm text-gray-800">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.code}{p.description ? ` · ${p.description}` : ''}</div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => startEdit(p)} className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-100">{t('admin.ui.permissions.editPermission')}</button>
                          <button onClick={() => remove(p)} className="px-2 py-1 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50">{t('admin.ui.permissions.deletePermission')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {permissions.length === 0 && <div className="text-center text-gray-400 text-sm py-8">-</div>}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-4">{editing ? t('admin.ui.permissions.editPermission') : t('admin.ui.permissions.addPermission')}</h3>
            <div className="space-y-3">
              <Field label={t('admin.ui.permissions.permCode')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={t('admin.ui.permissions.permCodePlaceholder')} />
              <Field label={t('admin.ui.permissions.permName')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder={t('admin.ui.permissions.permNamePlaceholder')} />
              <Field label={t('admin.ui.permissions.permModule')} value={form.module} onChange={(v) => setForm({ ...form, module: v })} placeholder={t('admin.ui.permissions.permModulePlaceholder')} />
              <Field label={t('admin.ui.permissions.permDesc')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder={t('admin.ui.permissions.permDescPlaceholder')} />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setView('list')} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">{t('admin.ui.permissions.cancel')}</button>
              <button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim() || !form.module.trim()} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{t('admin.ui.permissions.confirm')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoleModal({ open, editing, onClose, onSaved }: { open: boolean; editing: Role | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ code: '', name: '', description: '', sortOrder: '0' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { code: editing.code, name: editing.name, description: editing.description || '', sortOrder: String(editing.sortOrder ?? 0) }
        : { code: '', name: '', description: '', sortOrder: '0' });
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      const sortOrder = parseInt(form.sortOrder || '0', 10) || 0;
      if (editing) {
        await adminApi.roles.update(editing.code, { name: form.name, description: form.description, sortOrder });
      } else {
        await adminApi.roles.create({ code: form.code.trim(), name: form.name, description: form.description, sortOrder });
      }
      onSaved();
      onClose();
    } catch {
      // 失败时保持表单打开，交由 onSaved 上层提示
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl p-6 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">{editing ? t('admin.ui.permissions.editRole') : t('admin.ui.permissions.addRole')}</h3>
        <div className="space-y-3">
          <Field label={t('admin.ui.permissions.roleCode')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
          <Field label={t('admin.ui.permissions.roleName')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label={t('admin.ui.permissions.roleDesc')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Field label={t('admin.ui.permissions.roleSort')} value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">{t('admin.ui.permissions.cancel')}</button>
          <button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim()} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{t('admin.ui.permissions.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

function PermissionsContent() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, number[]>>({});
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) setSelectedRole(roleParam);
  }, [searchParams]);

  useEffect(() => { loadAll(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const roleListRes = await adminApi.roles.list();
      const roleList = roleListRes.data || [];
      setRoles(roleList);
      const [permRes, ...permByRoleRes] = await Promise.all([
        adminApi.permissions.list(),
        ...roleList.map(loadRolePermissions),
      ]);
      setPermissions(permRes.data || []);
      const map: Record<string, number[]> = {};
      permByRoleRes.forEach(r => { map[r.role] = r.ids; });
      setRolePerms(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const togglePermission = (permId: number) => {
    setRolePerms(prev => {
      const current = prev[selectedRole] || [];
      return { ...prev, [selectedRole]: current.includes(permId) ? current.filter(id => id !== permId) : [...current, permId] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.permissions.assign(selectedRole, rolePerms[selectedRole] || []);
      showToast(t('common.saveSuccess'));
    } catch (err) { console.error(err); showToast(t('common.saveFail'), 'error'); }
    finally { setSaving(false); }
  };

  const openCreateRole = () => { setEditingRole(null); setRoleModalOpen(true); };
  const openEditRole = (r: Role) => { setEditingRole(r); setRoleModalOpen(true); };

  const deleteRole = async (r: Role) => {
    if (!window.confirm(t('admin.ui.permissions.deleteRoleConfirm'))) return;
    try {
      await adminApi.roles.delete(r.code);
      showToast(t('common.saveSuccess'));
      if (selectedRole === r.code) setSelectedRole('SUPER_ADMIN');
      await loadAll();
    } catch (err) { console.error(err); showToast(t('common.saveFail'), 'error'); }
  };

  const afterRoleSaved = async () => {
    await loadAll();
    showToast(t('common.saveSuccess'));
  };

  const afterPermSaved = async () => {
    await loadAll();
    showToast(t('common.saveSuccess'));
  };

  const modules = [...new Set(permissions.map(p => p.module))];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      {toast && <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg text-sm z-50 shadow-lg ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.permissions')}</h1>
        {isSuperAdmin && <div className="flex gap-2">
          <button onClick={() => setPermModalOpen(true)} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{t('admin.ui.permissions.managePermissions')}</button>
          <button onClick={openCreateRole} className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800">{t('admin.ui.permissions.addRole')}</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
            {saving ? t('common.saving') : t('common.saveConfig')}
          </button>
        </div>}
      </div>

      <div className="flex gap-4">
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {roles.map((r) => (
              <div key={r.code} className="flex items-center border-b border-gray-100">
                <button
                  onClick={() => setSelectedRole(r.code)}
                  className={`flex-1 text-left px-4 py-3 text-sm transition-colors ${selectedRole === r.code ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {r.name}
                  {r.userCount > 0 && <span className={`ml-1.5 text-xs ${selectedRole === r.code ? 'text-gray-300' : 'text-gray-400'}`}>{r.userCount}</span>}
                </button>
                <div className={`flex pr-2 ${selectedRole === r.code ? '' : ''}`}>
                  {isSuperAdmin && <>
                  <button
                    onClick={() => openEditRole(r)}
                    className={`px-1.5 py-1 text-xs rounded hover:opacity-70 ${selectedRole === r.code ? 'text-gray-200' : 'text-gray-400'}`}
                    title={t('admin.ui.permissions.editRole')}
                  >✎</button>
                  <button
                    onClick={() => deleteRole(r)}
                    className={`px-1.5 py-1 text-xs rounded hover:opacity-70 ${selectedRole === r.code ? 'text-gray-200' : 'text-gray-400'}`}
                    title={t('admin.ui.permissions.deleteRole')}
                  >✕</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{t('admin.ui.permissions.rolePermTitle').replace('{name}', roles.find(r => r.code === selectedRole)?.name || selectedRole)}</h3>
          <div className="space-y-6">
            {modules.map(module => (
              <div key={module}>
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">{module}</h4>
                <div className="flex flex-wrap gap-2">
                  {permissions.filter(p => p.module === module).map(perm => {
                    const checked = (rolePerms[selectedRole] || []).includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => isSuperAdmin && togglePermission(perm.id)}
                        disabled={!isSuperAdmin}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:cursor-not-allowed ${
                          checked ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        } ${!isSuperAdmin ? 'opacity-60' : ''}`}
                      >
                        {perm.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PermManageModal open={permModalOpen} onClose={() => setPermModalOpen(false)} onSaved={afterPermSaved} />
      <RoleModal open={roleModalOpen} editing={editingRole} onClose={() => setRoleModalOpen(false)} onSaved={afterRoleSaved} />
    </div>
  );
}