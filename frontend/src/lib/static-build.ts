import snapshot from '@/lib/static-snapshot.json';
import { getListConfig, categoryEndpoint } from '@/lib/moduleConfig';
import type { CoreModule } from '@/types';

interface SnapshotModule {
  moduleKey: string;
  moduleType: number;
  path?: string;
  status: number;
}

interface SnapshotCategory {
  slug: string;
  value: string;
}

interface SnapshotContent {
  slug: string;
  status: number;
  categoryId?: number | string;
  groupName?: string;
}

interface StaticSnapshot {
  generatedAt: string;
  modules: SnapshotModule[];
  categories: Record<string, SnapshotCategory[]>;
  content: Record<string, SnapshotContent[]>;
}

const staticSnapshot = snapshot as StaticSnapshot;

function buildApiUrl(path: string): string {
  let base = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:8080';
  base = base.replace(/\/+$/, '');
  if (!base.endsWith('/api')) base += '/api';
  return `${base}${path}`;
}

// 一旦网络请求失败即标记后端不可达，后续所有请求直接走本地快照，避免反复等待超时。
let apiUnreachable = false;

async function fetchJson(path: string): Promise<any> {
  if (apiUnreachable) return null;
  const url = buildApiUrl(path);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return await res.json().catch(() => null);
  } catch {
    apiUnreachable = true;
    return null;
  }
}

/** 启用的核心模块（构建期）：优先后端实时数据，不可达或为空时回退到本地快照 */
export async function fetchActiveModules(): Promise<CoreModule[]> {
  const json = await fetchJson('/core-modules');
  const list = json?.data || json || [];
  const live = list.filter((m: any) => m.status === 1);
  if (live.length > 0) return live;
  return (staticSnapshot.modules || []) as CoreModule[];
}

function contentEndpoint(moduleKey: string): string {
  return `/content/${moduleKey}?page=1&size=999`;
}

/** 模块内容（构建期，仅已发布且有 slug 的）：优先后端实时数据，不可达或为空时回退到本地快照 */
export async function fetchModuleContent(moduleKey: string): Promise<any[]> {
  const json = await fetchJson(contentEndpoint(moduleKey));
  const records = json?.data?.records || json?.records || json?.data || [];
  const live = records.filter((r: any) => r.status === 1 && r.slug);
  if (live.length > 0) return live;
  return (staticSnapshot.content?.[moduleKey] || []) as any[];
}

export interface CategoryEntry {
  slug: string;
  value: string;
}

/** 嵌套模块的分类列表（构建期）：优先后端实时数据，不可达或为空时回退到本地快照 */
export async function fetchCategories(m: CoreModule): Promise<CategoryEntry[]> {
  const config = getListConfig(m.moduleKey, m.moduleType);
  if (!config.filter) return [];
  const json = await fetchJson(categoryEndpoint(m.moduleKey));
  const data = json?.data || json || [];
  const vf = config.filter.valueField;
  const live = data
    .map((item: any) => ({ slug: item.slug || String(item[vf]), value: String(item[vf]) }))
    .filter((c: CategoryEntry) => c.slug && c.value);
  if (live.length > 0) return live;
  return (staticSnapshot.categories?.[m.moduleKey] || []) as CategoryEntry[];
}

/** 分类过滤值 -> slug 映射（构建期） */
export async function fetchCategorySlugMap(m: CoreModule): Promise<Record<string, string>> {
  const cats = await fetchCategories(m);
  const map: Record<string, string> = {};
  for (const c of cats) map[c.value] = c.slug;
  return map;
}

/** 内容条目所属分类的过滤值（与分类列表 valueField 对齐） */
export function contentCategoryValue(moduleKey: string, item: any): string | undefined {
  return item.categoryId != null ? String(item.categoryId) : (item.groupName || undefined);
}

/**
 * 构建期兜底：参数列表为空时抛出清晰错误。
 * 说明：后端实时 API 与本地快照都无数据时才会触发；正常提交了快照（npm run snapshot）即可避免。
 */
export function ensureStaticParams<T>(route: string, params: T[]): T[] {
  if (params.length === 0) {
    throw new Error(
      `构建期未能为路由 ${route} 生成任何静态参数，且本地快照（src/lib/static-snapshot.json）也没有可用数据。` +
        `请在可访问后端 API 的机器上运行 \`npm run snapshot\` 重新生成并提交快照，` +
        `或为构建环境配置 API_BASE_URL / NEXT_PUBLIC_API_BASE_URL。` +
        `同时确认存在已启用的核心模块与已发布的带 slug 内容。`
    );
  }
  return params;
}
