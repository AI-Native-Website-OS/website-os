import type { CoreModule } from '@/types';

export const BUILTIN_KEYS = ['products', 'solutions', 'cases', 'resources'];

/** 内置模块中按“分类”组织（双层嵌套）的模块；首页始终以分类卡片展示，列表页也应始终支持分类筛选。 */
export const NESTED_BUILTIN_KEYS = ['products', 'solutions', 'resources'];

export function isNestedBuiltinModuleKey(key: string): boolean {
  return NESTED_BUILTIN_KEYS.includes(key);
}

/** 系统页面模块（首页/关于）：在核心模块管理中维护名称，但不作为内容模块渲染。 */
export const SYSTEM_PAGE_KEYS = ['home', 'about'];

export const LEGACY_TYPE_TO_KEY: Record<string, string> = {
  product: 'products',
  solution: 'solutions',
  case: 'cases',
  resource: 'resources',
};

export function isBuiltinModuleKey(key: string): boolean {
  return BUILTIN_KEYS.includes(key);
}

/** 是否为系统页面模块（首页/关于） */
export function isSystemPageModuleKey(key: string): boolean {
  return SYSTEM_PAGE_KEYS.includes(key);
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

/**
 * 分类对象 -> 列表页筛选参数。
 * 优先使用分类 slug，缺失时回退为分类 id，保证列表页（ModuleListView）始终能解析并完成筛选，
 * 与列表页筛选栏（全部/各分类）的行为保持一致。
 */
export function categoryFilterValue(cat: { slug?: string | null; id?: number | string | null }): string {
  if (cat.slug && cat.slug.trim()) return cat.slug;
  return cat.id != null ? String(cat.id) : '';
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
  if (isSystemPageModuleKey(module.moduleKey)) {
    if (module.path) return module.path;
    return module.moduleKey === 'about' ? '/about' : '/';
  }
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
  // 内置产品/方案/资源在首页始终按分类渲染，列表页也必须支持分类筛选，
  // 不能仅依赖 moduleType（历史数据/配置可能为单层），否则分类跳转会退化为“全部”。
  const nested = moduleType === 1 || isNestedBuiltinModuleKey(moduleKey);
  return {
    moduleKey,
    mode: 'generic',
    endpoint: `/content/${moduleKey}`,
    titleField: 'title',
    filter: nested
      ? { kind: 'category', endpoint: `/content/${moduleKey}/categories`, labelField: 'name', valueField: 'id', slugField: 'slug', param: 'categoryId' }
      : null,
  };
}
