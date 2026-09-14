'use client';

import { useEffect, useState } from 'react';
import { aiService } from '@/lib/aiService';
import { useI18n } from '@/i18n/I18nProvider';

type Tab = 'system_prompt' | 'suggestions' | 'banned_words' | 'ui_text';

export default function AdminAiPrompts() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('system_prompt');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [bannedWords, setBannedWords] = useState('');
  const [bannedThreshold, setBannedThreshold] = useState(82);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    aiService.promptConfig.get().then((res: any) => {
      setSystemPrompt(res.system_prompt || '');
      setSuggestions((res.suggestions || []).join('，'));
      setBannedWords((res.banned_words || []).join('，'));
      setBannedThreshold(Math.round((res.banned_threshold ?? 0.82) * 100));
      setWelcomeMessage(res.welcome_message || '');
      setInputPlaceholder(res.input_placeholder || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const sugItems = suggestions.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const bannedItems = bannedWords.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      await aiService.promptConfig.save({
        system_prompt: systemPrompt,
        suggestions: sugItems,
        banned_words: bannedItems,
        banned_threshold: bannedThreshold / 100,
        welcome_message: welcomeMessage,
        input_placeholder: inputPlaceholder,
      });
      alert(t('common.saveSuccess'));
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const tabs: { key: Tab; labelKey: string }[] = [
    { key: 'system_prompt', labelKey: 'admin.ui.prompts.tabSystem' },
    { key: 'ui_text', labelKey: 'admin.ui.prompts.tabUi' },
    { key: 'suggestions', labelKey: 'admin.ui.prompts.tabSuggestions' },
    { key: 'banned_words', labelKey: 'admin.ui.prompts.tabBanned' },
  ];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.ui.prompts.title')}</h1>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
          {saving ? t('common.saving') : t('common.saveAll')}
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tb.key ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'system_prompt' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{t('admin.ui.prompts.systemDescPrefix')}</p>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            className="w-full h-64 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            placeholder={t('admin.ui.prompts.systemPlaceholder')} />
        </div>
      )}

      {tab === 'ui_text' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-3">{t('admin.ui.prompts.uiDesc')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.prompts.welcomeLabel')}</label>
            <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder={t('admin.ui.prompts.welcomePlaceholder')} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.prompts.inputPlaceholderLabel')}</label>
            <input type="text" value={inputPlaceholder} onChange={e => setInputPlaceholder(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder={t('home.ai.placeholder')} />
          </div>
        </div>
      )}

      {tab === 'suggestions' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{t('admin.ui.prompts.suggestionsDesc')}</p>
          <textarea value={suggestions} onChange={e => setSuggestions(e.target.value)}
            className="w-full h-64 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            placeholder={t('admin.ui.prompts.suggestionsPlaceholder')} />
        </div>
      )}

      {tab === 'banned_words' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{t('admin.ui.prompts.bannedDesc')}</p>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-gray-700 min-w-fit">{t('admin.ui.prompts.thresholdLabel')}</span>
            <input type="range" min="0" max="100" value={bannedThreshold}
              onChange={e => setBannedThreshold(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black" />
            <span className="text-sm font-semibold text-gray-900 w-12 text-right">{bannedThreshold}%</span>
          </div>
          <textarea value={bannedWords} onChange={e => setBannedWords(e.target.value)}
            className="w-full h-56 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            placeholder={t('admin.ui.prompts.bannedPlaceholder')} />
        </div>
      )}
    </div>
  );
}
