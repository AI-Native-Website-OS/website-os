'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { parseBlockExtraData, validateBlockTypeData, blockTypes } from '@/lib/blockData';
import BlockTypeEditor, { El } from './BlockTypeEditor';
import { BLOCK_IMAGE_RULES } from '@/lib/uploadRules';
import { useI18n } from '@/i18n/I18nProvider';

interface BlockFormProps {
  item: { id?: number; sectionType?: string; title?: string; subtitle?: string; extraData?: string } | null;
  saving: boolean;
  onSave: (data: any) => void;
}

export default function BlockForm({ item, saving, onSave }: BlockFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [type, setType] = useState('list');
  const [data, setData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setSubtitle(item.subtitle || '');
      const t = item.sectionType || 'list';
      setType(t);
      const { data: d } = parseBlockExtraData(item.extraData);
      setData(d);
    } else {
      setTitle('');
      setSubtitle('');
      setType('list');
      setData({});
    }
    setErrors({});
    setSubmitError('');
  }, [item]);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setData({});
    setErrors({});
    setSubmitError('');
  };

  const updateData = (key: string, val: any) => setData((prev: any) => ({ ...prev, [key]: val }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t('adminComp.blockForm.errTitleRequired');
    if (title.length > 50) errs.title = t('adminComp.blockForm.errTitleMax');
    if (subtitle.length > 100) errs.subtitle = t('adminComp.blockForm.errSubtitleMax');

    const dataErrs = validateBlockTypeData(type, data);
    setErrors({ ...errs, ...dataErrs });
    return Object.keys(errs).length === 0 && Object.keys(dataErrs).length === 0;
  };

  const handleSubmit = () => {
    setSubmitError('');
    if (!validate()) return;
    const payload: any = {
      sectionType: type,
      title: title.trim(),
      subtitle: subtitle.trim(),
      extraData: JSON.stringify({ data }),
    };
    if (item?.id) payload.id = item.id;
    onSave(payload);
  };

  return (
    <div>
      {submitError && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{submitError}</div>}

      <div className="space-y-3">
        <El errors={errors} errorKey="title">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminComp.blockForm.title')} <span className="text-red-400">*</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('adminComp.blockForm.titlePlaceholder')} maxLength={50} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
          <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/50</p>
        </El>

        <El errors={errors} errorKey="subtitle">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminComp.blockForm.subtitle')}</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t('adminComp.blockForm.subtitlePlaceholder')} maxLength={100} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
          <p className="text-xs text-gray-400 mt-1 text-right">{subtitle.length}/100</p>
        </El>

        <El errors={errors} errorKey="type">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminComp.blockForm.displayType')} <span className="text-red-400">*</span></label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm">
            {blockTypes().map((bt) => <option key={bt.type} value={bt.type}>{bt.label} — {bt.desc}</option>)}
          </select>
        </El>

        <div className="border-t border-gray-200 pt-3 mt-3">
          <BlockTypeEditor type={type} data={data} errors={errors} updateData={updateData} imageRules={type === 'carousel' ? undefined : BLOCK_IMAGE_RULES} />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t('adminComp.saving') : t('adminComp.save')}
        </button>
      </div>
    </div>
  );
}