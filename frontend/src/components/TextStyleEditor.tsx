'use client';

import { FONT_FAMILY_PRESETS, normalizeTextStyle, textStyleToCss } from '@/lib/textStyle';
import type { TextStyle } from '@/types';

interface TextStyleEditorProps {
  value: TextStyle;
  onChange: (v: TextStyle) => void;
  t: (key: string) => string;
  previewText: string;
}

export default function TextStyleEditor({ value, onChange, t, previewText }: TextStyleEditorProps) {
  const s = normalizeTextStyle(value);
  const set = (patch: Partial<TextStyle>) => onChange({ ...s, ...patch });

  const numVal = (v?: number | null) => (v == null ? '' : String(v));
  const parseNum = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className={labelCls}>{t('admin.ui.prompts.styleFont')}</label>
          <select value={s.font_family} onChange={e => set({ font_family: e.target.value })} className={inputCls}>
            {FONT_FAMILY_PRESETS.map(p => <option key={p.key} value={p.value}>{t(p.labelKey)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('admin.ui.prompts.styleFontSize')}</label>
          <input type="number" min={8} max={200} value={numVal(s.font_size)}
            onChange={e => set({ font_size: parseNum(e.target.value) })} className={inputCls} placeholder="—" />
        </div>
        <div>
          <label className={labelCls}>{t('admin.ui.prompts.styleColor')}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={s.color || '#000000'} onChange={e => set({ color: e.target.value })}
              className="h-9 w-10 rounded border border-gray-200 cursor-pointer flex-shrink-0" />
            <input type="text" value={s.color} onChange={e => set({ color: e.target.value })}
              className={inputCls} placeholder="#000000" />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('admin.ui.prompts.styleFontStyle')}</label>
          <select value={s.font_style} onChange={e => set({ font_style: e.target.value as TextStyle['font_style'] })} className={inputCls}>
            <option value="normal">{t('admin.ui.prompts.styleNormal')}</option>
            <option value="bold">{t('admin.ui.prompts.styleBold')}</option>
            <option value="italic">{t('admin.ui.prompts.styleItalic')}</option>
            <option value="bold-italic">{t('admin.ui.prompts.styleBoldItalic')}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('admin.ui.prompts.styleLetterSpacing')}</label>
          <input type="number" step={0.5} value={numVal(s.letter_spacing)}
            onChange={e => set({ letter_spacing: parseNum(e.target.value) })} className={inputCls} placeholder="—" />
        </div>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 px-4 py-3">
        <span className="text-[11px] uppercase tracking-wide text-gray-400">{t('admin.ui.prompts.stylePreview')}</span>
        <div style={textStyleToCss(s)} className="mt-1 text-2xl text-gray-900 truncate">
          {previewText || t('admin.ui.prompts.stylePreviewEmpty')}
        </div>
      </div>
    </div>
  );
}
