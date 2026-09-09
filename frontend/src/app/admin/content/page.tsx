'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { useI18n } from '@/i18n/I18nProvider';
import { Plus, Pencil, Trash2, Search, Loader2, Image, ArrowLeft, Eye, Database, ChevronLeft, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import Modal from '@/components/Modal';
import BatchToolbar from '@/components/BatchToolbar';
import RichTextEditor from '@/components/RichTextEditor';
import ImageUploader from '@/components/ImageUploader';
import FileUploader from '@/components/FileUploader';
import FieldHint from '@/components/FieldHint';
import BlockTypeEditor from '@/components/BlockTypeEditor';
import RelatedContentMultiPicker, { type RelatedTarget } from '@/components/RelatedContentMultiPicker';
import { getImageUrl } from '@/lib/utils';
import { uploadFile } from '@/lib/api';
import { useConfirm } from '@/components/ConfirmDialog';
import { COVER_IMAGE_RULES, BLOCK_IMAGE_RULES, DEFAULT_DOCUMENT_RULES, COVER_IMAGE_RULE_HINTS, DOCUMENT_RULE_HINTS } from '@/lib/uploadRules';
import { COVER_SCALE_OPTIONS, DEFAULT_COVER_SCALE } from '@/lib/utils';
import { BLOCK_TYPES, parseContentSections, validateBlockTypeData, isSectionDataEmpty, getRecordSectionType, blockTypeLabel, type SectionEntry } from '@/lib/blockData';
import type { CoreModule, ContentModuleCategory, PageResult } from '@/types';

// 关联内容选择目标：字段名 = content_items.extraData.relations 中的 moduleKey
// 由核心模块管理中启用的模块动态生成

// 将 extraData.relations（{moduleKey: [id,...]}）解析为 picker 的 {field: "id,id"} 值
function parseRelations(extraData?: string): Record<string, string> {
  if (!extraData) return {};
  try {
    const parsed = JSON.parse(extraData);
    const rel = parsed?.relations;
    if (!rel || typeof rel !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rel)) {
      if (Array.isArray(v)) out[k] = (v as number[]).map(String).join(',');
    }
    return out;
  } catch {
    return {};
  }
}

// 将 picker 的 {field: "id,id"} 合并回 extraData.relations
function mergeRelations(extraData: string | undefined, relations: Record<string, string>): string {  const hasRel = Object.values(relations).some((v) => v && v.trim());
  if (!hasRel) return extraData || '';
  let root: any = {};
  if (extraData) {
    try { root = JSON.parse(extraData); } catch { root = {}; }
  }
  if (typeof root !== 'object' || root === null) root = {};
  const relMap: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(relations)) {
    const ids = v.split(',').map(Number).filter(Boolean);
    if (ids.length) relMap[k] = ids;
  }
  root.relations = relMap;
  return JSON.stringify(root);
}

// 列表「展示类型」徽标：多组显示组数，否则显示类型标签
function displayTypeLabel(record?: { extraData?: string } | null, t?: (k: string) => string): string {
  const count = parseContentSections(record?.extraData).length;
  if (count > 1) return (t ? t('admin.ui.content.groupsCount').replace('{n}', String(count)) : `${count} 组`);
  return blockTypeLabel(getRecordSectionType(record));
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const moduleKey = searchParams.get('module') || '';
  const { t } = useI18n();

  const [moduleMeta, setModuleMeta] = useState<CoreModule | null>(null);
  const [items, setItems] = useState<PageResult<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // 双层嵌套模块：分类层
  const [categories, setCategories] = useState<ContentModuleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<ContentModuleCategory | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedCat, setSelectedCat] = useState<ContentModuleCategory | null>(null);
  const [uncategorizedTotal, setUncategorizedTotal] = useState(0);
  const [catSorting, setCatSorting] = useState(false);
  const dragCatItem = useRef<number | null>(null);
  const dragCatOverItem = useRef<number | null>(null);

  const isNested = moduleMeta?.moduleType === 1;
  const filterCategoryId = selectedCat?.id ?? (view === 'detail' ? 0 : undefined);

  useEffect(() => {
    adminApi.coreModules.all().then((res: any) => {
      const found = (res.data || []).find((m: any) => m.moduleKey === moduleKey || (m.path && m.path.replace(/^\/+/, '') === moduleKey));
      setModuleMeta(found || null);
    }).catch(() => {});
  }, [moduleKey]);

  const loadCategories = useCallback(async () => {
    if (!moduleKey) return;
    setCatLoading(true);
    try {
      const res = await adminApi.contentCategories.list(moduleKey);
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCatLoading(false);
    }
  }, [moduleKey]);

  const loadUncategorizedTotal = useCallback(async () => {
    if (!moduleKey) return;
    try {
      const res = await adminApi.content.list(moduleKey, { page: 1, size: 1, categoryId: 0 });
      setUncategorizedTotal(res.data?.total || 0);
    } catch {
      setUncategorizedTotal(0);
    }
  }, [moduleKey]);

  useEffect(() => {
    if (isNested) {
      loadCategories();
      loadUncategorizedTotal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNested, moduleKey]);

  const load = useCallback(async () => {
    if (!moduleKey) return;
    if (isNested && view === 'list') return;
    setLoading(true);
    try {
      const res = await adminApi.content.list(moduleKey, { page, size: 10, keyword: keyword || undefined, categoryId: filterCategoryId });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, page, keyword, filterCategoryId, isNested, view]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      const data = { ...formData, slug: formData.slug || '', status: formData.status ?? 1 };
      if (editing?.id) {
        await adminApi.content.update(moduleKey, editing.id, data);
      } else {
        await adminApi.content.create(moduleKey, data);
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || err?.message || t('common.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm(t('admin.ui.content.deleteConfirm')))) return;
    try {
      await adminApi.content.delete(moduleKey, id);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (item: any) => {
    const newStatus = item.status === 1 ? 0 : 1;
    setItems((prev) => prev ? { ...prev, records: prev.records.map((r) => r.id === item.id ? { ...r, status: newStatus } : r) } : prev);
    try {
      await adminApi.content.update(moduleKey, item.id, { title: item.title, status: newStatus });
    } catch (err) {
      setItems((prev) => prev ? { ...prev, records: prev.records.map((r) => r.id === item.id ? { ...r, status: item.status } : r) } : prev);
      console.error(err);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleSelectAll = () => {
    if (!items?.records) return;
    if (selected.size === items.records.length) setSelected(new Set());
    else setSelected(new Set(items.records.map((r) => r.id)));
  };
  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!(await confirm(t('admin.ui.content.batchDeleteConfirm').replace('{n}', String(selected.size))))) return;
    setBatchLoading(true);
    try { await adminApi.content.batchDelete(moduleKey, Array.from(selected)); setSelected(new Set()); await load(); }
    catch (err) { console.error(err); }
    finally { setBatchLoading(false); }
  };
  const handleBatchStatus = async (status: number) => {
    if (selected.size === 0) return;
    setBatchLoading(true);
    try { await adminApi.content.batchStatus(moduleKey, Array.from(selected), status); setSelected(new Set()); await load(); }
    catch (err) { console.error(err); }
    finally { setBatchLoading(false); }
  };

  // ── 分类 CRUD ──

  const handleCatSave = async (formData: Partial<ContentModuleCategory>) => {
    setCatSaving(true);
    try {
      if (editingCat?.id) {
        await adminApi.contentCategories.update(moduleKey, editingCat.id, formData);
      } else {
        await adminApi.contentCategories.create(moduleKey, formData);
      }
      setShowCatForm(false);
      setEditingCat(null);
      await loadCategories();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || t('common.saveFail'));
    } finally {
      setCatSaving(false);
    }
  };

  const handleCatDelete = async (item: ContentModuleCategory) => {
    if (!(await confirm(t('admin.ui.content.deleteCatConfirm').replace('{name}', item.name)))) return;
    try {
      await adminApi.contentCategories.delete(moduleKey, item.id);
      await loadCategories();
      await loadUncategorizedTotal();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || t('admin.ui.content.deleteFail'));
    }
  };

  const enterCat = (cat: ContentModuleCategory) => {
    setSelectedCat(cat);
    setView('detail');
    setItems(null);
    setKeyword('');
    setPage(1);
    setSelected(new Set());
  };

  const enterUncategorized = () => {
    setSelectedCat(null);
    setView('detail');
    setItems(null);
    setKeyword('');
    setPage(1);
    setSelected(new Set());
  };

  const backToList = () => {
    setView('list');
    setSelectedCat(null);
    setItems(null);
    setPage(1);
    setSelected(new Set());
  };

  const handleCatDragStart = (index: number) => { dragCatItem.current = index; };
  const handleCatDragOver = (index: number) => { dragCatOverItem.current = index; };

  const handleCatDrop = async () => {
    const from = dragCatItem.current;
    const to = dragCatOverItem.current;
    dragCatItem.current = null;
    dragCatOverItem.current = null;
    if (from === null || to === null || from === to) return;
    const updated = [...categories];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setCategories(updated);
    setCatSorting(true);
    try {
      await adminApi.contentCategories.reorder(moduleKey, updated.map((c) => c.id));
      await loadCategories();
    } catch (err) {
      console.error(err);
      await loadCategories();
    } finally {
      setCatSorting(false);
    }
  };

  if (!moduleKey) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">{t('admin.ui.content.noModule')}</p>
        <Link href="/admin/modules" className="inline-flex items-center gap-2 text-sm text-black font-medium">
          <ArrowLeft className="w-4 h-4" /> {t('admin.ui.content.backModules')}
        </Link>
      </div>
    );
  }

  const headerTitle = isNested && view === 'detail'
    ? selectedCat?.name || t('admin.ui.content.uncategorized')
    : `${moduleMeta?.moduleName || moduleKey} · ${t('admin.page.content')}`;

  return (
    <div>
      {ConfirmDialog}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {isNested && view === 'detail' && (
            <button onClick={backToList} className="p-2 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{headerTitle}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {isNested
                ? view === 'detail'
                  ? t('admin.ui.content.catManageDetail')
                  : t('admin.ui.content.catManageList')
                : t('admin.ui.content.moduleDesc').replace('{module}', moduleMeta?.moduleName || moduleKey)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/modules" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('admin.ui.content.backModuleManage')}
          </Link>
          {isNested ? (
            view === 'list' ? (
              <button
                onClick={() => { setEditingCat(null); setShowCatForm(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('admin.ui.content.addCategory')}
              </button>
            ) : (
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('admin.ui.content.addContent')}
              </button>
            )
          ) : (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('admin.ui.content.addContent')}
            </button>
          )}
        </div>
      </div>

      {/* ── 双层嵌套：分类列表 ── */}
      {isNested && view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className={`relative ${catSorting ? 'pointer-events-none opacity-70' : ''}`}>
            {catSorting && (
              <div className="absolute inset-x-0 top-0 z-10 bg-black/80 text-white text-xs text-center py-1.5">
                {t('admin.ui.content.savingOrder')}
              </div>
            )}
            <div className="divide-y divide-gray-100">
            {catLoading && categories.length === 0 ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : categories.length === 0 && uncategorizedTotal === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('admin.ui.content.noCategories')}</p>
              </div>
            ) : (
              <>
                {uncategorizedTotal > 0 && (
                  <div
                    onClick={enterUncategorized}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{t('admin.ui.content.uncategorized')}</div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{t('admin.ui.content.legacyItems').replace('{n}', String(uncategorizedTotal))}</div>
                    </div>
                    <span className="text-xs text-gray-400">{t('admin.ui.content.itemsCount').replace('{n}', String(uncategorizedTotal))}</span>
                  </div>
                )}
                {categories.map((cat, index) => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => handleCatDragStart(index)}
                    onDragOver={(e) => { e.preventDefault(); handleCatDragOver(index); }}
                    onDrop={handleCatDrop}
                    onDragEnd={() => { dragCatItem.current = null; dragCatOverItem.current = null; }}
                    onClick={() => enterCat(cat)}
                    className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors group ${dragCatItem.current === index ? 'opacity-50' : ''}`}
                  >
                    <span
                      className="flex items-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
                      title={t('admin.ui.content.dragSort')}
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {cat.coverImage ? (
                        <img src={getImageUrl(cat.coverImage)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Database className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {cat.name}
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${cat.status === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {cat.status === 1 ? t('common.enable') : t('common.disable')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{cat.description || t('admin.ui.content.noDesc')}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCat(cat); setShowCatForm(true); }}
                        className="p-2 text-gray-300 hover:text-black opacity-0 group-hover:opacity-100 transition-all"
                        title={t('common.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCatDelete(cat); }}
                        className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ── 分类表单 ── */}
      <Modal open={showCatForm} onClose={() => { setShowCatForm(false); setEditingCat(null); }} title={editingCat ? t('admin.ui.content.editCategory') : t('admin.ui.content.addCategory')}>
        <CategoryForm item={editingCat} saving={catSaving} onSave={handleCatSave} />
      </Modal>

      {/* ── 内容列表（单层 / 双层嵌套分类下） ── */}
      {(!isNested || view === 'detail') && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }}
                placeholder={t('admin.ui.content.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button onClick={() => { setPage(1); load(); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.search')}</button>
          </div>

          <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? t('admin.ui.content.editContent') : t('admin.ui.content.addContent')} width="w-[920px]">
            <ContentForm item={editing} moduleKey={moduleKey} saving={saving} onSave={handleSave} categoryId={filterCategoryId} categoryName={isNested && view === 'detail' ? selectedCat?.name : undefined} nested={isNested} />
          </Modal>

          {selected.size > 0 && (
            <BatchToolbar
              selectedCount={selected.size}
              onDelete={handleBatchDelete}
              onPublish={() => handleBatchStatus(1)}
              onUnpublish={() => handleBatchStatus(0)}
              loading={batchLoading}
            />
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-10 py-3 px-2">
                    <input type="checkbox"
                      checked={(items?.records?.length ?? 0) > 0 && selected.size === (items?.records?.length ?? 0)}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 cursor-pointer" />
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 w-16">{t('admin.ui.content.colCover')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.content.colTitle')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.content.colType')}</th>
                  {isNested && <th className="text-left py-3 px-4 font-medium text-gray-500">{t('admin.ui.content.colGroup')}</th>}
                  <th className="text-left py-3 px-4 font-medium text-gray-500">slug</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">{t('admin.ui.content.colStatus')}</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">{t('admin.ui.content.colViews')}</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items?.records?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 px-2">
                      <input type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 cursor-pointer" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.coverImage ? (
                        <img src={getImageUrl(item.coverImage)} alt="" className="w-12 h-8 object-cover rounded border border-gray-200" />
                      ) : (
                        <div className="w-12 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300">
                          {/* eslint-disable-next-line jsx-a11y/alt-text */}
                          <Image className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">{item.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {displayTypeLabel(item, t)}
                      </span>
                    </td>
                    {isNested && <td className="py-3 px-4 text-gray-500">{item.groupName || '-'}</td>}
                    <td className="py-3 px-4 text-gray-500"><span className="font-mono text-xs">{item.slug}</span></td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleStatus(item)} className={`px-2 py-0.5 rounded text-xs cursor-pointer ${item.status === 1 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{item.status === 1 ? t('common.enable') : t('common.disable')}</button>
                    </td>
                    <td className="py-3 px-4 text-center">{item.viewCount || 0}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1 text-gray-500 hover:text-black"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!items?.records || items.records.length === 0) && (
                  <tr><td colSpan={isNested ? 9 : 8} className="py-8 text-center text-gray-400">{loading ? t('common.loading') : t('admin.ui.content.noContent')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {items && items.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: items.pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-black text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryForm({ item, saving, onSave }: { item: ContentModuleCategory | null; saving: boolean; onSave: (data: Partial<ContentModuleCategory>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    coverImage: item?.coverImage || '',
    sortOrder: item?.sortOrder ?? 0,
    status: item?.status ?? 1,
  });
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    let img = form.coverImage;
    if (pendingImage) {
      const result = await uploadFile(pendingImage, 'temp', undefined, 'cover');
      img = result.url;
      setPendingImage(null);
    }
    onSave({ ...form, coverImage: img });
  };

  return (
    <div>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.catCover')} <FieldHint text={COVER_IMAGE_RULE_HINTS} /></label>
          <ImageUploader value={form.coverImage} file={pendingImage} onFileSelect={setPendingImage} onChange={(v) => update('coverImage', v)} rules={COVER_IMAGE_RULES} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.catName')} <span className="text-red-400">*</span></label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.catDesc')}</label>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm resize-none" />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

function initSections(item: any | null): SectionEntry[] {
  if (!item) return [{ sectionType: 'rich_text', data: { content: '' } }];
  const sections = parseContentSections(item.extraData);
  if (sections.length > 0) return sections;
  if (item.content) return [{ sectionType: 'rich_text', data: { content: item.content } }];
  return [{ sectionType: 'rich_text', data: { content: '' } }];
}

function ContentForm({ item, moduleKey, saving, onSave, categoryId, categoryName, nested }: { item: any | null; moduleKey: string; saving: boolean; onSave: (data: any) => void; categoryId?: number; categoryName?: string; nested: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: item?.title || '',
    categoryId: item?.categoryId ?? (categoryId === 0 ? null : categoryId ?? null),
    groupName: item?.groupName || '',
    summary: item?.summary || '',
    coverImage: item?.coverImage || '',
    coverScale: item?.coverScale || DEFAULT_COVER_SCALE,
    filePath: item?.filePath || '',
    fileName: item?.fileName || '',
    fileSize: item?.fileSize || null,
  });
  const [sections, setSections] = useState<SectionEntry[]>(() => initSections(item));
  const [sectionsErrors, setSectionsErrors] = useState<Record<number, Record<string, string>>>({});
  const [relations, setRelations] = useState<Record<string, string>>(() => parseRelations(item?.extraData));
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [relationTargets, setRelationTargets] = useState<RelatedTarget[]>([]);

  useEffect(() => {
    let mounted = true;
    adminApi.coreModules.all().then((res: any) => {
      if (!mounted) return;
      const mods = (res.data || []).filter((m: any) => m.status === 1);
      setRelationTargets(mods.map((m: any) => ({ field: m.moduleKey, type: m.moduleKey, label: m.moduleName })));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const updateSection = (i: number, patch: Partial<SectionEntry>) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const updateSectionData = (i: number, key: string, val: any) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, data: { ...s.data, [key]: val } } : s)));
  };

  const addSection = () => {
    setSections((prev) => [...prev, { sectionType: 'rich_text', data: { content: '' } }]);
  };

  const removeSection = (i: number) => {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setSectionsErrors((prev) => {
      const next: Record<number, Record<string, string>> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < i) next[idx] = v;
        else if (idx > i) next[idx - 1] = v;
      });
      return next;
    });
  };

  const moveSection = (i: number, dir: -1 | 1) => {
    setSections((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const handleSectionTypeChange = (i: number, newType: string) => {
    updateSection(i, { sectionType: newType, data: {} });
    setSectionsErrors((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (form.coverImage && !form.coverScale) {
      alert(t('admin.ui.content.coverScaleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const errs: Record<number, Record<string, string>> = {};
      const filled: SectionEntry[] = [];
      sections.forEach((s, i) => {
        if (isSectionDataEmpty(s)) return;
        filled.push(s);
        const e = validateBlockTypeData(s.sectionType, s.data);
        if (Object.keys(e).length > 0) errs[i] = e;
      });
      if (Object.keys(errs).length > 0) {
        setSectionsErrors(errs);
        alert(t('admin.ui.content.completeGroups'));
        return;
      }

      const extraData = mergeRelations(
        JSON.stringify({ sections: filled.map((s) => ({ sectionType: s.sectionType, data: s.data })) }),
        relations
      );

      const content = filled
        .filter((s) => s.sectionType === 'rich_text')
        .map((s) => s.data.content || '')
        .join('');

      let data: any = { ...form, content, extraData };

      if (pendingImage) {
        const result = await uploadFile(pendingImage, 'content', moduleKey, 'cover');
        data = { ...data, coverImage: result.url };
        setPendingImage(null);
      }

      if (pendingFile) {
        const result = await uploadFile(pendingFile, 'content', moduleKey, 'document');
        data = { ...data, filePath: result.url, fileName: result.name, fileSize: pendingFile.size };
        setPendingFile(null);
      }

      onSave(data);
    } catch (err: any) {
      console.error('Save failed:', err);
      alert(err?.message || t('common.saveFail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
<div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.cover')} <FieldHint text={COVER_IMAGE_RULE_HINTS} /></label>
            <ImageUploader value={form.coverImage} file={pendingImage} onFileSelect={setPendingImage} onChange={(v) => update('coverImage', v)} rules={COVER_IMAGE_RULES} />
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.coverScale')} <span className="text-red-400">*</span> <FieldHint text={[t('admin.ui.content.coverScaleHint')]} /></label>
              <select
                value={form.coverScale}
                onChange={(e) => update('coverScale', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                {COVER_SCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        {nested ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.category')}</label>
            <input
              value={categoryName || (item?.categoryId ? `分类#${item.categoryId}` : t('admin.ui.content.uncategorized'))}
              disabled
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-500"
            />
          </div>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.title')} <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <RelatedContentMultiPicker targets={relationTargets} values={relations} onChange={setRelations} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.relatedDoc')} <FieldHint text={DOCUMENT_RULE_HINTS} /></label>
          <FileUploader
            filePath={form.filePath}
            fileName={form.fileName}
            file={pendingFile}
            onFileSelect={setPendingFile}
            onRemove={() => { update('filePath', ''); update('fileName', ''); update('fileSize', null); }}
            rules={DEFAULT_DOCUMENT_RULES}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.ui.content.summary')}</label>
          <textarea value={form.summary} onChange={(e) => update('summary', e.target.value)} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">{t('admin.ui.content.contentGroups')} <span className="text-gray-400 font-normal text-xs">{t('admin.ui.content.optional')}</span></label>
          <span className="text-xs text-gray-400">{t('admin.ui.content.groupsCount').replace('{n}', String(sections.length))}</span>
        </div>
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <select
                  value={s.sectionType}
                  onChange={(e) => handleSectionTypeChange(i, e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                >
                  {BLOCK_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label} — {t.desc}</option>)}
                </select>
                <button onClick={() => moveSection(i, -1)} disabled={i === 0} title={t('admin.ui.content.moveUp')} className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} title={t('admin.ui.content.moveDown')} className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => removeSection(i)} disabled={sections.length <= 1} title={t('common.delete')} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                {s.sectionType === 'rich_text' ? (
                  <>
                    <RichTextEditor value={s.data.content || ''} onChange={(v) => updateSectionData(i, 'content', v)} placeholder={t('admin.ui.content.richTextPlaceholder')} />
                    {sectionsErrors[i]?.richText && <p className="text-xs text-red-500 mt-2">{sectionsErrors[i].richText}</p>}
                  </>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
                    <BlockTypeEditor type={s.sectionType} data={s.data} errors={sectionsErrors[i] || {}} updateData={(k, v) => updateSectionData(i, k, v)} imageRules={BLOCK_IMAGE_RULES} />
                  </div>
                )}
                {sectionsErrors[i] && Object.keys(sectionsErrors[i]).length > 0 && (
                  <p className="text-xs text-red-500 mt-2">{t('admin.ui.content.groupIncomplete')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSection} className="mt-3 text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-dashed border-gray-300 rounded-md w-full flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> {t('admin.ui.content.addGroup')}
        </button>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSubmit}
          disabled={saving || submitting || !form.title.trim()}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
        >
          {saving || submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving || submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
