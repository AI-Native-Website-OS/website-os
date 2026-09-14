'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Search, Calendar, User, Eye } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl, formatDate } from '@/lib/utils';
import { getListConfig, detailUrl, nestedDetailUrl, listUrl, categoryUrl, type ListModuleConfig } from '@/lib/moduleConfig';
import { loadModule } from '@/lib/moduleLoader';
import type { CoreModule, ContentModuleCategory } from '@/types';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import PageState from '@/components/PageState';

interface FilterOption {
  label: string;
  value: string;
  slug: string;
}

function itemCategoryValue(moduleKey: string, item: any): string | undefined {
  return item.categoryId != null ? String(item.categoryId) : (item.groupName || undefined);
}

type ListFilter = NonNullable<ListModuleConfig['filter']>;

function buildCategoryFilterOptions(cats: ContentModuleCategory[]) {
  const options: FilterOption[] = [];
  const valueToSlug: Record<string, string> = {};
  const slugToVal: Record<string, string> = {};
  const categoryMap: Record<number, string> = {};
  for (const c of cats) {
    categoryMap[c.id] = c.name;
    const value = String(c.id);
    const slug = c.slug || value;
    options.push({ label: c.name, value, slug });
    if (slug) {
      valueToSlug[value] = slug;
      slugToVal[slug] = value;
    }
  }
  return { options, valueToSlug, slugToVal, categoryMap };
}

function buildFieldFilterOptions(data: any[], filter: ListFilter) {
  const options: FilterOption[] = [];
  const valueToSlug: Record<string, string> = {};
  const slugToVal: Record<string, string> = {};
  for (const item of data) {
    const label = item[filter.labelField] as string | undefined;
    const value: string = String(item[filter.valueField] ?? '');
    if (!label) continue;
    const slug = item.slug || value;
    options.push({ label, value, slug });
    if (slug) {
      valueToSlug[value] = slug;
      slugToVal[slug] = value;
    }
  }
  return { options, valueToSlug, slugToVal };
}

function buildDistinctFilterOptions(records: any[], filter: ListFilter): FilterOption[] {
  const options: FilterOption[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    const value = r[filter.valueField];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ label: value as string, value: value as string, slug: '' });
  }
  return options;
}

export function ModuleListView({ moduleKey, categorySlug }: { moduleKey: string; categorySlug?: string }) {
  const [module, setModule] = useState<CoreModule | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string>(moduleKey);
  const [config, setConfig] = useState<ListModuleConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});
  const [slugMap, setSlugMap] = useState<Record<string, string>>({});
  const [slugToValue, setSlugToValue] = useState<Record<string, string>>({});
  const [filterReady, setFilterReady] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, total: 0 });
  const currentPage = pagination.current;

  useEffect(() => {
    loadModule(moduleKey).then((m) => {
      if (!m) {
        setNotFound(true);
        return;
      }
      setModule(m);
      setResolvedKey(m.moduleKey);
      setConfig(getListConfig(m.moduleKey, m.moduleType));
    });
  }, [moduleKey]);

  const loadFilterOptions = useCallback(async (cfg: ListModuleConfig) => {
    setFilterReady(false);
    if (!cfg.filter) {
      setFilterOptions([]);
      setSlugMap({});
      setSlugToValue({});
      setFilterReady(true);
      return;
    }
    try {
      const options: FilterOption[] = [];
      let valueToSlug: Record<string, string> = {};
      let slugToVal: Record<string, string> = {};
      if (cfg.filter.endpoint) {
        const res: any = await api.get(cfg.filter.endpoint);
        const data = res.data || [];
        if (cfg.filter.kind === 'category') {
          const built = buildCategoryFilterOptions(data);
          setCategoryMap(built.categoryMap);
          options.push(...built.options);
          valueToSlug = built.valueToSlug;
          slugToVal = built.slugToVal;
        } else {
          const built = buildFieldFilterOptions(data, cfg.filter);
          options.push(...built.options);
          valueToSlug = built.valueToSlug;
          slugToVal = built.slugToVal;
        }
      } else {
        const res: any = await api.get(cfg.endpoint, { params: { page: 1, size: 999 } });
        const records = res.data.records || [];
        options.push(...buildDistinctFilterOptions(records, cfg.filter));
      }
      setFilterOptions(options);
      setSlugMap(valueToSlug);
      setSlugToValue(slugToVal);
    } catch {
      setFilterOptions([]);
      setSlugMap({});
      setSlugToValue({});
    } finally {
      setFilterReady(true);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    loadFilterOptions(config);
  }, [config, loadFilterOptions]);

  useEffect(() => {
    if (!config || !config.filter) {
      setSelectedFilter(null);
      return;
    }
    if (!categorySlug) {
      setSelectedFilter(null);
      return;
    }
    if (!filterReady) return;
    const value = slugToValue[categorySlug];
    if (value !== undefined) {
      setSelectedFilter(value);
    } else {
      setNotFound(true);
    }
  }, [config, categorySlug, slugToValue, filterReady]);

  const fetchItems = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const params: any = { page: currentPage, size: 12 };
      if (config.filter && selectedFilter) params[config.filter.param] = selectedFilter;
      if (keyword) params.keyword = keyword;
      const response: any = await api.get(config.endpoint, { params });
      setItems(response.data.records || []);
      setPagination((prev) => ({ ...prev, total: response.data.total || 0 }));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [config, currentPage, selectedFilter, keyword]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const totalPages = Math.ceil(pagination.total / 12);

  const renderCard = (item: any, index: number) => {
    const title = item[config?.titleField || 'title'] || '';
    let tag = '';
    if (config?.filter?.kind === 'category') {
      tag = item.categoryId ? categoryMap[item.categoryId] || '' : '';
    }
    const isResource = resolvedKey === 'resources';
    const isCases = resolvedKey === 'cases';
    const href = (() => {
      const slug = item.slug;
      if (config?.filter) {
        const value = itemCategoryValue(resolvedKey, item);
        const catSlug = value != null ? slugMap[value] : undefined;
        return catSlug ? nestedDetailUrl(resolvedKey, catSlug, slug) : detailUrl(resolvedKey, slug);
      }
      return detailUrl(resolvedKey, slug);
    })();
    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-gray-300/80 transition-all duration-300"
      >
        <div
          className="h-48 bg-gray-100 relative"
          style={item.coverImage ? { backgroundImage: `url("${getImageUrl(item.coverImage)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {tag && (
            <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs rounded-full font-medium shadow-sm">
              {tag}
            </span>
          )}
        </div>
        <div className="p-6">
          {isResource && (
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
              {item.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(item.publishedAt)}
                </span>
              )}
              {item.author && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {item.viewCount || 0}
              </span>
            </div>
          )}
          <h3 className={`text-gray-900 mb-2 ${isResource ? 'text-lg font-semibold line-clamp-2' : 'text-xl font-semibold'}`}>
            {title}
          </h3>
          <p className={`text-gray-500 mb-4 line-clamp-3 ${isResource ? 'text-sm' : ''}`}>{item.summary}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-black hover:text-gray-700 font-medium"
          >
            {isResource ? '阅读全文' : isCases ? '查看详情' : '了解更多'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    );
  };

  if (notFound) {
    return <PageState error="页面不存在或模块已禁用" />;
  }

  const title = module?.moduleTitle || module?.moduleName || '内容中心';
  const description = module?.moduleDescription || '';
  const searchPlaceholder = `搜索${module?.moduleName || '内容'}...`;

  return (
    <>
      <SeoHead
        title={title}
        description={description || ''}
        keywords={title}
        path={listUrl(resolvedKey)}
        breadcrumbs={[
          { name: '首页', url: '/' },
          { name: title, url: listUrl(resolvedKey) },
        ]}
      />
      <div className="bg-white min-h-screen">
        <section className="pt-28 pb-12 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb items={[
              { name: '首页', url: '/' },
              { name: title, url: listUrl(resolvedKey) },
            ]} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">{title}</h1>
              {description && <p className="text-lg text-gray-500 max-w-2xl mx-auto">{description}</p>}
            </motion.div>
          </div>
        </section>

        <section className="sticky top-16 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 py-4">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 max-w-md w-full">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                  />
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {config?.filter && filterOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={listUrl(resolvedKey)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      !categorySlug
                        ? 'bg-black text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    全部
                  </Link>
                  {filterOptions.map((opt) => (
                    <Link
                      key={opt.value}
                      href={opt.slug ? categoryUrl(resolvedKey, opt.slug) : listUrl(resolvedKey)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        categorySlug === opt.slug
                          ? 'bg-black text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <PageState loading={loading} empty={!loading && items.length === 0} emptyMessage={`暂无${module?.moduleName || '内容'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.map((item, index) => renderCard(item, index))}
              </div>
            </PageState>

            {totalPages > 1 && (
              <div className="flex justify-center mt-12 gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setPagination((prev) => ({ ...prev, current: page }))}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-all duration-200 ${
                      pagination.current === page
                        ? 'bg-black text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
