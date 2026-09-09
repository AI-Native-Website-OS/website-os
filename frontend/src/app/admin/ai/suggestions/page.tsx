'use client';

import { useEffect, useState } from 'react';
import { aiService } from '@/lib/aiService';
import { useI18n } from '@/i18n/I18nProvider';

export default function AdminAiSuggestions() {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiService.promptConfig.get().then((res: any) => {
      setValue((res.suggestions || []).join('，'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const items = value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      await aiService.promptConfig.save({
        system_prompt: '',
        suggestions: items,
        banned_words: [],
      });
      alert(t('common.saveSuccess'));
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.ui.suggestions.title')}</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.ui.suggestions.subtitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('admin.ui.prompts.suggestionsDesc')}</p>
        <textarea value={value} onChange={e => setValue(e.target.value)}
          className="w-full h-48 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none mb-4"
          placeholder={t('admin.ui.suggestions.placeholder')} />
        <div className="flex justify-end">
          <button onClick={saveConfig} disabled={saving}
            className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
