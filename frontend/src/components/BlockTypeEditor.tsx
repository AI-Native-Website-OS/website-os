'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Bold, Italic, Underline, List, ListOrdered, Link, ImageIcon as ImageIconLucide, Palette, Trash2, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import FieldHint from './FieldHint';
import { BLOCK_TYPES, blockTypeLabel } from '@/lib/blockData';
import type { ImageUploadRules } from '@/lib/uploadRules';
import { BLOCK_IMAGE_RULE_HINTS, HTML_IMAGE_RULES, validateImageFile } from '@/lib/uploadRules';
import { getImageUrl } from '@/lib/utils';
import { HtmlBlockView } from '@/components/HtmlBlockView';
import api from '@/lib/api';

const ICON_OPTIONS = [
  { value: '', label: '无图标' },
  { value: 'Shield', label: 'Shield - 盾牌' },
  { value: 'Zap', label: 'Zap - 闪电' },
  { value: 'Globe', label: 'Globe - 地球' },
  { value: 'Users', label: 'Users - 用户' },
  { value: 'Heart', label: 'Heart - 爱心' },
  { value: 'Star', label: 'Star - 星星' },
  { value: 'Target', label: 'Target - 目标' },
  { value: 'TrendingUp', label: 'TrendingUp - 增长' },
  { value: 'Award', label: 'Award - 奖项' },
  { value: 'BookOpen', label: 'BookOpen - 书本' },
  { value: 'Cpu', label: 'Cpu - 芯片' },
  { value: 'Cloud', label: 'Cloud - 云' },
  { value: 'Lock', label: 'Lock - 锁' },
  { value: 'Compass', label: 'Compass - 指南针' },
  { value: 'Layers', label: 'Layers - 分层' },
  { value: 'Settings', label: 'Settings - 设置' },
  { value: 'Bell', label: 'Bell - 通知' },
  { value: 'Calendar', label: 'Calendar - 日历' },
  { value: 'Camera', label: 'Camera - 相机' },
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
  return (
    <input value={value} onChange={(e) => onUpdate(rowIndex, col, e.target.value)} placeholder={`请输入${col}`} maxLength={200} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
  );
}

function ModuleIconPicker({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ICON_OPTIONS.filter((o) => o.value).map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value === value ? '' : opt.value)}
          className={`p-1.5 rounded border transition-colors ${value === opt.value ? 'border-black bg-gray-100' : 'border-gray-200 hover:border-gray-400'}`}
          title={opt.label}
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
            数据行 <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">（{rows.length} 行，{columns.length} 字段）</span>
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
                          title="双击修改字段名"
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
                  <button type="button" onClick={addColumn} className="p-0.5 text-gray-400 hover:text-black" title="添加字段">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="w-12 px-2 py-2 text-xs font-medium text-gray-500 text-center border-b border-gray-300">操作</th>
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
          <Plus className="w-3 h-3" /> 添加数据行
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
            模块列表 <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">（{moduleItems.length} 个模块）</span>
          </label>
        </div>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {moduleItems.map((mod: any, i: number) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-400 font-mono">模块 {i + 1}</span>
                <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-3">
                <El errors={errors} errorKey={`mod_title_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">模块标题 <span className="text-red-400">*</span></label>
                  <input value={mod.title || ''} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder="请输入模块标题" maxLength={100} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors} errorKey={`mod_subtitle_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">模块副标题</label>
                  <input value={mod.subtitle || ''} onChange={(e) => updateItem(i, 'subtitle', e.target.value)} placeholder="选填" maxLength={100} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors}>
                  <label className="block text-xs text-gray-500 mb-0.5">图标</label>
                  <ModuleIconPicker value={mod.icon} onSelect={(v) => updateItem(i, 'icon', v)} />
                </El>
                <El errors={errors} errorKey={`mod_desc_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">模块描述</label>
                  <textarea value={mod.description || ''} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="请输入模块描述" rows={3} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(mod.description || '').length}/200</p>
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-3 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> 添加模块
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
            图文组 <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">（{groups.length} 组）</span>
          </label>
        </div>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {groups.map((g: any, i: number) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-400 font-mono">图文组 {i + 1}</span>
                <button type="button" onClick={() => removeGroup(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-3">
                <El errors={errors} errorKey={`img_group_img_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">图片 <span className="text-red-400">*</span>{imageRules && <FieldHint text={BLOCK_IMAGE_RULE_HINTS} />}</label>
                  <ImageUploader value={g.image} onChange={(url) => updateGroup(i, 'image', url)} autoUpload uploadType="cases" rules={imageRules} />
                </El>
                <El errors={errors} errorKey={`img_group_desc_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">图片描述</label>
                  <textarea value={g.description} onChange={(e) => updateGroup(i, 'description', e.target.value)} placeholder="请输入图片描述" rows={3} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(g.description || '').length}/200</p>
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addGroup} className="mt-3 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> 添加图文组
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
            时间节点 <span className="text-red-400">*</span>
            <span className="ml-2 text-xs text-gray-400">（{timeline.length} 个节点）</span>
          </label>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {timeline.map((node: any, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-400 font-mono">节点 {i + 1}</span>
                <button type="button" onClick={() => removeNode(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-2">
                <El errors={errors} errorKey={`tl_date_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">日期 <span className="text-red-400">*</span></label>
                  <input type="date" value={node.date} onChange={(e) => updateNode(i, 'date', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
                <El errors={errors} errorKey={`tl_content_${i}`}>
                  <label className="block text-xs text-gray-500 mb-0.5">描述内容</label>
                  <textarea value={node.content} onChange={(e) => updateNode(i, 'content', e.target.value)} placeholder="请输入描述内容" rows={2} maxLength={200} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none" />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{(node.content || '').length}/200</p>
                </El>
                <El errors={errors}>
                  <label className="block text-xs text-gray-500 mb-0.5">标签</label>
                  <input value={node.tag || ''} onChange={(e) => updateNode(i, 'tag', e.target.value)} placeholder="选填，如：里程碑、荣誉" maxLength={50} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm" />
                </El>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addNode} className="mt-2 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> 添加时间节点
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
    const url = prompt('请输入链接地址：');
    if (url) execRichText('createLink', url);
  };

  const insertImage = () => {
    const url = prompt('请输入图片地址：');
    if (url) execRichText('insertImage', url);
  };

  const setHeading = (tag: string) => {
    document.execCommand('formatBlock', false, tag);
    if (editorRef.current) updateData('content', editorRef.current.innerHTML);
  };

  const setColor = () => {
    const color = prompt('请输入颜色值（如 #ff0000）：');
    if (color) execRichText('foreColor', color);
  };

  const setBgColor = () => {
    const color = prompt('请输入背景色（如 #ffff00）：');
    if (color) execRichText('hiliteColor', color);
  };

  const renderRichTextForm = () => {
    const btnClass = 'p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-30';

    return (
      <div>
        <div className="flex items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">富文本内容 <span className="text-red-400">*</span></label>
        </div>
        <div className="border border-gray-300 rounded-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <button type="button" className={btnClass} onClick={() => setHeading('<h1>')} title="标题1"><span className="text-xs font-bold">H1</span></button>
            <button type="button" className={btnClass} onClick={() => setHeading('<h2>')} title="标题2"><span className="text-xs font-bold">H2</span></button>
            <button type="button" className={btnClass} onClick={() => setHeading('<h3>')} title="标题3"><span className="text-xs font-bold">H3</span></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('bold')} title="加粗"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('italic')} title="斜体"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('underline')} title="下划线"><Underline className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={setColor} title="文字颜色"><Palette className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={setBgColor} title="背景色"><span className="inline-block w-3.5 h-3.5 rounded border border-gray-300" style={{ backgroundColor: '#ffff00' }} /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('insertUnorderedList')} title="无序列表"><List className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={() => execRichText('insertOrderedList')} title="有序列表"><ListOrdered className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={insertLink} title="插入链接"><Link className="w-3.5 h-3.5" /></button>
            <button type="button" className={btnClass} onClick={insertImage} title="插入图片"><ImageIconLucide className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" className={btnClass} onClick={() => execRichText('removeFormat')} title="清除格式"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[200px] max-h-[400px] overflow-y-auto px-3 py-2 text-sm outline-none prose prose-sm max-w-none"
            onInput={onEditorInput}
            onBlur={onEditorInput}
            data-placeholder="请输入富文本内容..."
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
          <label className="block text-sm font-medium text-gray-700">HTML 源码 <span className="text-red-400">*</span></label>
        </div>
        <div className="border border-gray-300 rounded-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center bg-gray-200 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setHtmlMode('src')}
                className={`px-3 py-1 text-xs rounded transition-colors ${htmlMode === 'src' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                源码
              </button>
              <button
                type="button"
                onClick={() => setHtmlMode('prev')}
                className={`px-3 py-1 text-xs rounded transition-colors ${htmlMode === 'prev' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                预览
              </button>
            </div>
            <span className="w-px h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              onClick={() => htmlImageInputRef.current?.click()}
              disabled={htmlUploading}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-500 disabled:opacity-50"
              title="上传图片并自动插入到源码光标处"
            >
              {htmlUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIconLucide className="w-3.5 h-3.5" />}
              上传图片并插入
            </button>
            <input ref={htmlImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>
          {htmlMode === 'src' ? (
            <textarea
              ref={htmlTextareaRef}
              value={html}
              onChange={(e) => updateData('html', e.target.value)}
              placeholder="在此粘贴 HTML 源码，如 <div>、表格、统计卡片等"
              spellCheck={false}
              className="w-full min-h-[220px] px-3 py-2 font-mono text-xs leading-relaxed outline-none resize-y"
            />
          ) : (
            <HtmlBlockView html={html} />
          )}
        </div>
        {htmlUploadError && <p className="text-xs text-red-500 mt-1">{htmlUploadError}</p>}
        <p className="text-xs text-gray-400 mt-1.5">
          提示：HTML 源码将在前台原样渲染（含脚本与交互），效果与本地浏览器打开一致。
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
            <label className="text-sm text-gray-700">自动播放</label>
            <button
              type="button"
              onClick={() => updateData('autoPlay', !autoPlay)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoPlay ? 'bg-black' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoPlay ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">切换间隔（秒）</label>
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
              轮播图片 <span className="text-red-400">*</span>
              {imageRules && <FieldHint text={BLOCK_IMAGE_RULE_HINTS} />}
              <span className="ml-2 text-xs text-gray-400">（{items.length} 张）</span>
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
      <div className="text-xs text-gray-400 mb-2">当前类型：{blockTypeLabel(type)} — {BLOCK_TYPES.find((t) => t.type === type)?.desc}</div>
      {switchRender()}
    </div>
  );
}