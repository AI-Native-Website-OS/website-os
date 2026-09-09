import type { CoreModule } from '@/types';

export const BUILTIN_KEYS = ['products', 'solutions', 'cases', 'resources'];

export const LEGACY_TYPE_TO_KEY: Record<string, string> = {
  product: 'products',
  solution: 'solutions',
  case: 'cases',
  resource: 'resources',
};

export function isBuiltinModuleKey(key: string): boolean {
  return BUILTIN_KEYS.includes(key);
}

/** 模块列表页 /list/category?moduleKey=<m> */
export function listUrl(moduleKey: string): string {
  return `/list/category?moduleKey=${encodeURIComponent(moduleKey)}`;
}

/** 嵌套模块分类列表页 /list/category?moduleKey=<m>&categorySlug=<c> */
export function categoryUrl(moduleKey: string, categorySlug: string): string {
  if (!categorySlug) return listUrl(moduleKey);
  return `/list/category?moduleKey=${encodeURIComponent(moduleKey)}&categorySlug=${encodeURIComponent(categorySlug)}`;
}

/** 扁平详情页（无分类上下文） /list/detail?moduleKey=<m>&slug=<s> */
export function detailUrl(moduleKey: string, slug: string): string {
  return `/list/detail?moduleKey=${encodeURIComponent(moduleKey)}&slug=${encodeURIComponent(slug)}`;
}

/** 嵌套详情页 /list/category/detail?moduleKey=<m>&categorySlug=<c>&slug=<s> */
export function nestedDetailUrl(moduleKey: string, categorySlug: string, slug: string): string {
  if (!categorySlug) return detailUrl(moduleKey, slug);
  return `/list/category/detail?moduleKey=${encodeURIComponent(moduleKey)}&categorySlug=${encodeURIComponent(categorySlug)}&slug=${encodeURIComponent(slug)}`;
}

export function moduleHref(module: CoreModule): string {
  return listUrl(module.moduleKey);
}

/** 模块分类列表接口（统一内容引擎） */
export function categoryEndpoint(moduleKey: string): string {
  return `/content/${moduleKey}/categories`;
}

export function resolveModule(modules: CoreModule[], segment: string): CoreModule | undefined {
  return modules.find((m) => m.moduleKey === segment);
}

export interface ListFilterConfig {
  kind: 'category' | 'group';
  endpoint: string;
  labelField: string;
  valueField: string;
  slugField?: string;
  param: string;
}

export interface ListModuleConfig {
  moduleKey: string;
  mode: 'generic';
  endpoint: string;
  titleField: 'title';
  filter: ListFilterConfig | null;
}

export function getListConfig(moduleKey: string, moduleType?: number): ListModuleConfig {
  return {
    moduleKey,
    mode: 'generic',
    endpoint: `/content/${moduleKey}`,
    titleField: 'title',
    filter: moduleType === 1
      ? { kind: 'category', endpoint: `/content/${moduleKey}/categories`, labelField: 'name', valueField: 'id', slugField: 'slug', param: 'categoryId' }
      : null,
  };
}
