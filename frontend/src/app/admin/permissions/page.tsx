'use client';

import { Suspense, useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Permission, Role } from '@/types';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n/I18nProvider';

export default function AdminPermissions() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>}>
      <PermissionsContent />
    </Suspense>
  );
}

function PermissionsContent() {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, number[]>>({});
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) setSelectedRole(roleParam);
  }, [searchParams]);

  useEffect(() => { loadAll(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
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
        ...roleList.map(r => adminApi.permissions.getByRole(r.code).then(res => ({ role: r.code, ids: res.data?.map(p => p.id) || [] }))),
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
    } catch (err) { console.error(err); showToast(t('common.saveFail')); }
    finally { setSaving(false); }
  };

  const modules = [...new Set(permissions.map(p => p.module))];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 px-4 py-2 bg-black text-white rounded-lg text-sm z-50 shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.page.permissions')}</h1>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
          {saving ? t('common.saving') : t('common.saveConfig')}
        </button>
      </div>

      <div className="flex gap-4">
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {roles.map((r) => (
              <button
                key={r.code}
                onClick={() => setSelectedRole(r.code)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 transition-colors ${selectedRole === r.code ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {r.name}
              </button>
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
                        onClick={() => togglePermission(perm.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          checked ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
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
    </div>
  );
}
