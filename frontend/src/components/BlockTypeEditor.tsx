'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Bold, Italic, Underline, List, ListOrdered, Link, ImageIcon as ImageIconLucide, Palette, Trash2, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import FieldHint from './FieldHint';
import { blockTypeLabel, blockTypeDesc } from '@/lib/blockData';
import type { ImageUploadRules } from '@/lib/uploadRules';
import { blockImageRuleHints, HTML_IMAGE_RULES, validateImageFile } from '@/lib/uploadRules';
import { getImageUrl } from '@/lib/utils';
import { HtmlBlockView } from '@/components/HtmlBlockView';
import api from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

const ICON_OPTIONS = [
  { value: '', labelKey: 'adminComp.icon.none' },
  { value: 'Shield', labelKey: 'adminComp.icon.shield' },
  { value: 'Zap', labelKey: 'adminComp.icon.zap' },
  { value: 'Globe', labelKey: 'adminComp.icon.globe' },
  { value: 'Users', labelKey: 'adminComp.icon.users' },
  { value: 'Heart', labelKey: 'adminComp.icon.heart' },
  { value: 'Star', labelKey: 'adminComp.icon.star' },
  { value: 'Target', labelKey: 'adminComp.icon.target' },
  { value: 'TrendingUp', labelKey: 'adminComp.icon.trendingUp' },
  { value: 'Award', labelKey: 'adminComp.icon.award' },
  { value: 'BookOpen', labelKey: 'adminComp.icon.bookOpen' },
  { value: 'Cpu', labelKey: 'adminComp.icon.cpu' },
  { value: 'Cloud', labelKey: 'adminComp.icon.cloud' },
  { value: 'Lock', labelKey: 'adminComp.icon.lock' },
  { value: 'Compass', labelKey: 'adminComp.icon.compass' },
  { value: 'Layers', labelKey: 'adminComp.icon.layers' },
  { value: 'Settings', labelKey: 'adminComp.icon.settings' },
  { value: 'Bell', labelKey: 'adminComp.icon.bell' },
  { value: 'Calendar', labelKey: 'adminComp.icon.calendar' },
  { value: 'Camera', labelKey: 'adminComp.icon.camera' },
];

function IconPreview({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  if (!name) return null;
  const Comp = (LucideIcons as any)[name];
  return Comp ? <Comp className={className} /> : <span className="text-xs text-gray-400">?</span>;
}

function El({ errors, errorKey, children, className = '' }: { errors: Record<string, string>; errorKey?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
      {errorKey && errors[errorKey] && <p className="text-xs text-red-500 mt-1">{errors[errorKey]}</p>}
    </div>
  );
}

function ListCellInput({ value, rowIndex, col, onUpdate }: { value: string; rowIndex: number; col: string; onUpdate: (i: number, field: string, val: string) => void }) {
  const { t } = useI18n();
  return (
    <input value={value} onChange={(e) => onUpdate(rowIndex, col, e.target.value)} placeholder={t('adminComp.blockList.cellPlaceholder', { col })} maxLength={200} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
  );
}

function ModuleIconPicker({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-1">
      {ICON_OPTIONS.filter((o) => o.value).map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value === value ? '' : opt.value)}
          className={`p-1.5 rounded border transition-colors ${value === opt.value ? 'border-black bg-gray-100' : 'border-gray-200 hover:border-gray-400'}`}
          title={t(opt.labelKey)}
        >
          <IconPreview name={opt.value} className="w-4 h-4 text-gray-600" />
        </button>
      ))}
    </div>
  );
}

export { El, ICON_OPTIONS, IconPreview };

interface BlockTypeEditorProps {
  type: string;
  data: any;
  errors: Record<string, string>;
  toggledKeys?: Record<string, any>;
  updateData: (key: string, val: any) => void;
  imageRules?: ImageUploadRules;
}

/**
 * 按展示类型渲染对应数据编辑器。
 * 抽取自 BlockForm，供首页/关于区块与内容管理新增内容复用。
 */
export default function BlockTypeEditor({ type, data, errors, updateData, imageRules }: BlockTypeEditorProps) {
  const { t } = useI18n();
  const switchRender = (): React.ReactNode | null => {
    switch (type) {
      case 'list': return renderListForm();
      case 'module': return renderModuleForm();
      case 'image_text': return renderImageTextForm();
      case 'timeline': return renderTimelineForm();
      case 'rich_text': return renderRichTextForm();
      case 'html': return renderHtmlForm();
      case 'carousel': return renderCarouselForm();
      default: return null;
    }
  };

  // ─── 列表（MySQL 表格样式，可配置字段） ──────────────
  const [editingCol, setEditingCol] = useState<number | null>(null);

  const renderListForm = () => {
    const columns: string[] = (data.columns && data.columns.length > 0) ? data.columns : ['key', 'value'];
    const rows = data.rows || [];

    const normalizeRow = (row: any) => {
      const r: any = {};
      columns.forEach((c) => { r[c] = row[c] || ''; });
      return r;
    };
    const normalizedRows = rows.map(normalizeRow);

    const updateSchema = (newCols: string[], newRows: any[]) => {
      updateData('columns', newCols);
      updateData('rows', newRows);
    };

    const addColumn = () => {
      const baseName = 'field';
      let idx = 1;
      while (columns.includes(`${baseName}${idx}`)) idx++;
      const name = `${baseName}${idx}`;
      const newCols = [...columns, name];
      updateSchema(newCols, normalizedRows.map((r: any) => ({ ...r, [name]: '' })));
    };

    const removeColumn = (i: number) => {
      if (columns.length <= 1) return;
      const oldName = columns[i];
      const newCols = columns.filter((_, idx) => idx !== i);
      updateSchema(newCols, normalizedRows.map((r: any) => {
        const { [oldName]: _, ...rest } = r;
        return rest;
      }));
    };

    const renameColumn = (i: number, newName: string) => {
      setEditingCol(null);
      const trimmed = newName.trim();
      if (!trimmed || trimmed === columns[i]) return;
      if (columns.includes(trimmed)) return;
      const oldName = columns[i];
      const newCols = [...columns];
      newCols[i] = trimmed;
      updateSchema(newCols, normalizedRows.map((r: any) => {
        const { [oldName]: val, ...rest } = r;
        return { ...rest, [trimmed]: val };
      }));
    };

    const addRow = () => {
      const row: any = {};
      columns.forEach((c) => { row[c] = ''; });
      updateData('rows', [...rows, row]);
    };

    const removeRow = (i: number) => updateData('rows', rows.filter((_: any, idx: number) => idx !== i));
    const updateRow = (i: number, field: string, val: string) => {
      const copy = [...rows];
      copy[i] = { ...copy[i], [field]: val };
      updateData('rows', copy);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('adminComp.blockList.dataRows')} <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">{t('adminComp.blockList.rowsSummary', { rows: rows.length, cols: columns.length })}</span>
          </label>
        </div>
        <div className="overflow-x-auto border border-gray-300 rounded-md">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-10 px-2 py-2 text-xs font-medium text-gray-500 text-center border-b border-gray-300">#</th>
                {columns.map((col, i) => (
                  <th key={i} className="px-2 py-2 text-left border-b border-gray-300 border-r border-gray-200 min-w-[100px]">
                    <div className="flex items-center gap-1">
                      {editingCol === i ? (
                        <input
                          defaultValue={col}
                          autoFocus
                          className="w-full px-1 py-0.5 text-xs border border-gray-400 rounded font-medium"
                          onBlur={(e) => renameColumn(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameColumn(i, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingCol(null);
                          }}
                        />
                      ) : (
                        <span
                          className="text-xs font-medium text-gray-500 cursor-pointer hover:text-black truncate flex-1"
                          onDoubleClick={() => setEditingCol(i)}
                          title={t('adminComp.blockList.renameFieldHint')}
                        >
                          {col}
                        </span>
                      )}
                      {columns.length > 1 && (
                        <button type="button" onClick={() => removeColumn(i)} className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-12 px-2 py-2 text-center border-b border-gray-300">
                  <button type="button" onClick={addColumn} className="p-0.5 text-gray-400 hover:text-black" title={t('adminComp.blockList.addField')}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="w-12 px-2 py-2 text-xs font-medium text-gray-500 text-center border-b border-gray-300">{t('adminComp.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {normalizedRows.map((row: any, i: number) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-2 py-1.5 text-xs text-gray-400 text-center border-b border-gray-200 font-mono">{i + 1}</td>
                  {columns.map((col, ci) => (
                    <td key={ci} className="px-2 py-1.5 border-b border-gray-200 border-r border-gray-200">
                      <ListCellInput value={row[col] || ''} rowIndex={i} col={col} onUpdate={updateRow} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 border-b border-gray-200" />
                  <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                    <button type="button" onClick={() => removeRow(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addRow} className="mt-2 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> {t('adminComp.blockList.addDataRow')}
        </button>
        <El errors={errors} errorKey="rows" />
      </div>
    );
  };

  // ─── 模块（支持多模块） ─────────────────────────────────
  const renderModuleForm = () => {
    const items = data.items || [];

    const normalizeItems = () => {
      if (items.length === 0 && (data.title || data.description)) {
        return [{ title: data.title || '', subtitle: data.subtitle || '', icon: data.icon || '', description: data.description || '' }];
      }
      return items;
    };

    const moduleItems = normalizeItems();

    const addItem = () => updateData('items', [...moduleItems, { title: '', subtitle: '', icon: '', description: '' }]);
    const removeItem = (i: number) => {
      const copy = [...moduleItems];
      copy.splice(i, 1);
      updateData('items', copy);
    };
    const updateItem = (i: number, field: string, val: string) => {
      const copy = [...moduleItems];
      copy[i] = { ...copy[i], [field]: val };
      updateData('items', copy);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('adminComp.blockModule.list')} <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">{t('adminComp.blockModule.count', { n: moduleItems.length })}</span>
          </label>
        </div>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {moduleItems.map((mod: any, i: number) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-400 font-mono">{t('adminComp.blockModule.itemN', { n: i + 1 })}</span>
                <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-3">
                <El errors={errors} errorKey={`mod_title_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockModule.title')} <span className="text-red-400">*</span></label>
                  <input value={mod.title || ''} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder={t('adminComp.blockModule.titlePlaceholder')} maxLength={100} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors} errorKey={`mod_subtitle_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockModule.subtitle')}</label>
                  <input value={mod.subtitle || ''} onChange={(e) => updateItem(i, 'subtitle', e.target.value)} placeholder={t('adminComp.optional')} maxLength={100} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockModule.icon')}</label>
                  <ModuleIconPicker value={mod.icon} onSelect={(v) => updateItem(i, 'icon', v)} />
                </El>
                <El errors={errors} errorKey={`mod_desc_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockModule.desc')}</label>
                  <textarea value={mod.description || ''} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder={t('adminComp.blockModule.descPlaceholder')} rows={3} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(mod.description || '').length}/200</p>
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-3 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> {t('adminComp.blockModule.add')}
        </button>
        <El errors={errors} errorKey="moduleItems" />
      </div>
    );
  };

  // ─── 图文（支持多组） ─────────────────────────────────
  const renderImageTextForm = () => {
    const groups = data.groups || [];
    const addGroup = () => updateData('groups', [...groups, { image: '', description: '' }]);
    const removeGroup = (i: number) => updateData('groups', groups.filter((_: any, idx: number) => idx !== i));
    const updateGroup = (i: number, field: string, val: string) => {
      const copy = [...groups];
      copy[i] = { ...copy[i], [field]: val };
      updateData('groups', copy);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('adminComp.blockImageText.group')} <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">{t('adminComp.blockImageText.count', { n: groups.length })}</span>
          </label>
        </div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {groups.map((g: any, i: number) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-400 font-mono">{t('adminComp.blockImageText.groupN', { n: i + 1 })}</span>
                <button type="button" onClick={() => removeGroup(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-3">
                <El errors={errors} errorKey={`img_group_img_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockImageText.image')} <span className="text-red-400">*</span>{imageRules && <FieldHint text={blockImageRuleHints()} />}</label>
                  <ImageUploader value={g.image} onChange={(url) => updateGroup(i, 'image', url)} autoUpload uploadType="cases" rules={imageRules} />
                </El>
                <El errors={errors} errorKey={`img_group_desc_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockImageText.desc')}</label>
                  <textarea value={g.description} onChange={(e) => updateGroup(i, 'description', e.target.value)} placeholder={t('adminComp.blockImageText.descPlaceholder')} rows={3} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(g.description || '').length}/200</p>
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addGroup} className="mt-3 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> {t('adminComp.blockImageText.add')}
        </button>
        <El errors={errors} errorKey="imageText" />
      </div>
    );
  };

  // ─── 时间线 ───────────────────────────────────────────────
  const renderTimelineForm = () => {
    const timeline = data.timeline || [];
    const addNode = () => updateData('timeline', [...timeline, { date: '', content: '', tag: '' }]);
    const removeNode = (i: number) => updateData('timeline', timeline.filter((_: any, idx: number) => idx !== i));
    const updateNode = (i: number, field: string, val: string) => {
      const copy = [...timeline];
      copy[i] = { ...copy[i], [field]: val };
      updateData('timeline', copy);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('adminComp.blockTimeline.title')} <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">{t('adminComp.blockTimeline.count', { n: timeline.length })}</span>
          </label>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {timeline.map((node: any, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-400 font-mono">{t('adminComp.blockTimeline.nodeN', { n: i + 1 })}</span>
                <button type="button" onClick={() => removeNode(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-2">
                <El errors={errors} errorKey={`tl_date_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockTimeline.date')} <span className="text-red-400">*</span></label>
                  <input type="date" value={node.date} onChange={(e) => updateNode(i, 'date', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors} errorKey={`tl_content_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockTimeline.content')}</label>
                  <textarea value={node.content} onChange={(e) => updateNode(i, 'content', e.target.value)} placeholder={t('adminComp.blockTimeline.contentPlaceholder')} rows={2} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(node.content || '').length}/200</p>
                </El>
                <El errors={errors}>
                  <label className="block text-xs text-gray-500 mb-0.5">{t('adminComp.blockTimeline.tag')}</label>
                  <input value={node.tag || ''} onChange={(e) => updateNode(i, 'tag', e.target.value)} placeholder={t('adminComp.blockTimeline.tagPlaceholder')} maxLength={50} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addNode} className="mt-2 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> {t('adminComp.blockTimeline.add')}
        </button>
        <El errors={errors} errorKey="timeline" />
      </div>
    );
  };

  // ─── 富文本编辑器 ─────────────────────────────────────────
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && type === 'rich_text') {
      const val = data.content || '';
      if (editorRef.current.innerHTML !== val) {
        editorRef.current.innerHTML = val;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const execRichText = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      updateData('content', editorRef.current.innerHTML);
    }
  }, [updateData]);

  const onEditorInput = useCallback(() => {
    if (editorRef.current) {
      updateData('content', editorRef.current.innerHTML);
    }
  }, [updateData]);

  const insertLink = () => {
    const url = prompt(t('adminComp.richText.promptLink'));
    if (url) execRichText('createLink', url);
  };

  const insertImage = () => {
    const url = prompt(t('adminComp.richText.promptImage'));
    if (url) execRichText('insertImage', url);
  };

  const setHeading = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    if (editorRef.current) updateData('content', editorRef.current.innerHTML);
  };

  const setColor = () => {
    const color = prompt(t('adminComp.richText.promptColor'));
    if (color) execRichText('foreColor', color);
  };

  const setBgColor = () => {
    const color = prompt(t('adminComp.richText.promptBgColor'));
    if (color) execRichText('hiliteColor', color);
  };

  const renderRichTextForm = () => {
    const btnClass = 'p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-30';

    return (
      <div>
        <div className="flex items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">{t('adminComp.richText.content')} <span className="text-red-400">*</span></label>
        </div>
        <div className="border border-gray-300 rounded-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <button type="button" className={btnClass} onClick={() => setHeading('<h1>')} title={t('adminComp.richText.h1')}><span className="text-xs font-bold">H1</span></button>
            <button type="button" className={btnClass} onClick={() => setHeading('<h2>')} title={t('adminComp.richText.h2')}><span className="text-xs font-bold">H2</span></button>
            <button type="button" className={btnClass} onClick={() => setHeading('<h3>')} title={t('adminComp.richText.h3')}><span className="text-xs font-bold">H3</span></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('bold')} title={t('adminComp.richText.bold')}><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('italic')} title={t('adminComp.richText.italic')}><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('underline')} title={t('adminComp.richText.underline')}><Underline className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={setColor} title={t('adminComp.richText.textColor')}><Palette className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={setBgColor} title={t('adminComp.richText.bgColor')}><span className="inline-block w-3.5 h-3.5 rounded border border-gray-300" style={{ backgroundColor: '#ffff00' }} /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('insertUnorderedList')} title={t('adminComp.richText.ul')}><List className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('insertOrderedList')} title={t('adminComp.richText.ol')}><ListOrdered className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={insertLink} title={t('adminComp.richText.insertLink')}><Link className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={insertImage} title={t('adminComp.richText.insertImage')}><ImageIconLucide className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('removeFormat')} title={t('adminComp.richText.clearFormat')}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[200px] max-h-[400px] overflow-y-auto px-3 py-2 text-sm outline-none prose prose-sm max-w-none"
            onInput={onEditorInput}
            onBlur={onEditorInput}
            data-placeholder={t('adminComp.richText.placeholder')}
          />
        </div>
        <El errors={errors} errorKey="richText" />
      </div>
    );
  };

  // ─── HTML 源码编辑器（含实时预览 + 上传图片插入） ──────────
  const [htmlMode, setHtmlMode] = useState<'src' | 'prev'>('src');
  const [htmlUploading, setHtmlUploading] = useState(false);
  const [htmlUploadError, setHtmlUploadError] = useState('');
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const htmlImageInputRef = useRef<HTMLInputElement>(null);

  const renderHtmlForm = () => {
    const html = data.html || '';

    const insertAtCursor = (text: string) => {
      const el = htmlTextareaRef.current;
      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        updateData('html', next);
        requestAnimationFrame(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = start + text.length;
        });
        return;
      }
      // 预览模式下 textarea 未挂载：切回源码编辑并追加到末尾
      setHtmlMode('src');
      updateData('html', (data.html || '') + text);
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      setHtmlUploadError('');
      const err = await validateImageFile(f, HTML_IMAGE_RULES);
      if (err) { setHtmlUploadError(err); return; }
      setHtmlUploading(true);
      try {
        const form = new FormData();
        form.append('file', f);
        form.append('type', 'cases');
        form.append('validate', 'image-any');
        const res: any = await api.post('/upload', form);
        const url = res.code === 200 ? (res.data?.url || res.url) : '';
        if (url) insertAtCursor(`<img src="${getImageUrl(url)}" alt="" />`);
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setHtmlUploading(false);
      }
    };

    return (
      <div>
        <div className="flex items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">{t('adminComp.html.sourceLabel')} <span className="text-red-400">*</span></label>
        </div>
        <div className="border border-gray-300 rounded-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center bg-gray-200 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setHtmlMode('src')}
                className={`px-3 py-1 text-xs rounded transition-colors ${htmlMode === 'src' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                {t('adminComp.html.src')}
              </button>
              <button
                type="button"
                onClick={() => setHtmlMode('prev')}
                className={`px-3 py-1 text-xs rounded transition-colors ${htmlMode === 'prev' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                {t('adminComp.html.preview')}
              </button>
            </div>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              onClick={() => htmlImageInputRef.current?.click()}
              disabled={htmlUploading}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-500 disabled:opacity-50"
              title={t('adminComp.html.uploadInsertHint')}
            >
              {htmlUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIconLucide className="w-3.5 h-3.5" />}
              {t('adminComp.html.uploadInsert')}
            </button>
            <input ref={htmlImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>
          {htmlMode === 'src' ? (
            <textarea
              ref={htmlTextareaRef}
              value={html}
              onChange={(e) => updateData('html', e.target.value)}
              placeholder={t('adminComp.html.placeholder')}
              spellCheck={false}
              className="w-full min-h-[220px] px-3 py-2 font-mono text-xs leading-relaxed outline-none resize-y"
            />
          ) : (
            <HtmlBlockView html={html} />
          )}
        </div>
        {htmlUploadError && <p className="text-xs text-red-500 mt-1">{htmlUploadError}</p>}
        <p className="text-xs text-gray-400 mt-1.5">
          {t('adminComp.html.tip')}
        </p>
        <El errors={errors} errorKey="html" />
      </div>
    );
  };

  // ─── 轮播图（无标题，支持批量上传） ──────────────────────
  const renderCarouselForm = () => {
    const items = data.items || [];
    const autoPlay = data.autoPlay !== false;
    const interval = data.interval || 3;

    const removeItem = (i: number) => updateData('items', items.filter((_: any, idx: number) => idx !== i));

    const handleImagesChange = (images: string[]) => {
      updateData('items', images.map((url) => ({ image: url })));
    };

    const itemImages = items.map((item: any) => item.image);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">{t('adminComp.carousel.autoPlay')}</label>
            <button
              type="button"
              onClick={() => updateData('autoPlay', !autoPlay)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoPlay ? 'bg-black' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoPlay ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">{t('adminComp.carousel.interval')}</label>
            <input
              type="number"
              min={1}
              max={10}
              value={interval}
              onChange={(e) => updateData('interval', Math.min(10, Math.max(1, Number(e.target.value))))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('adminComp.carousel.images')} <span className="text-red-400">*</span>
              {imageRules && <FieldHint text={blockImageRuleHints()} />}
              <span className="ml-2 text-xs text-gray-400">{t('adminComp.carousel.count', { n: items.length })}</span>
            </label>
          </div>
          <MultiImageUploader images={itemImages} onChange={handleImagesChange} uploadType="cases" rules={imageRules} />
          <El errors={errors} errorKey="carousel" />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">{t('adminComp.currentType')}{blockTypeLabel(type)} — {blockTypeDesc(type)}</div>
      {switchRender()}
    </div>
  );
}