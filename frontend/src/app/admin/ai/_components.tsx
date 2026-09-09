import { useI18n } from '@/i18n/I18nProvider';

export function ConfigEditor({ title, description, value, onChange, onSave, saving, placeholder, multiline }: {
  title: string; description: string; value: string; onChange: (v: string) => void; onSave: () => void; saving: boolean; placeholder?: string; multiline?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={12} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black font-mono" placeholder={placeholder} />
      ) : (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={6} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder={placeholder} />
      )}
      <div className="flex justify-end mt-4">
        <button onClick={onSave} disabled={saving} className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
          {saving ? t('common.saving') : t('common.saveConfig')}
        </button>
      </div>
    </div>
  );
}
