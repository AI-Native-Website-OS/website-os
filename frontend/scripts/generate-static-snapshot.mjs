#!/usr/bin/env node
// 生成静态构建兜底快照 src/lib/static-snapshot.json
// 用法：在可访问后端 API 的机器上执行 `npm run snapshot`
//   API_BASE_URL=http://<backend-host>:8080 npm run snapshot
// 生成结果需提交到仓库，供无法访问后端的构建环境（如测试 Jenkins）在构建期使用。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/lib/static-snapshot.json');

function buildApiUrl(path) {
  let base = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:8080';
  base = base.replace(/\/+$/, '');
  if (!base.endsWith('/api')) base += '/api';
  return `${base}${path}`;
}

async function fetchJson(path) {
  const url = buildApiUrl(path);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

const BUILTIN_KEYS = ['products', 'solutions', 'cases', 'resources'];
const isBuiltin = (key) => BUILTIN_KEYS.includes(key);

function categoryEndpoint(key) {
  return `/content/${key}/categories`;
}

function contentEndpoint(key) {
  return `/content/${key}?page=1&size=999`;
}

// 与 frontend/src/lib/moduleConfig.ts 的 getListConfig().filter.valueField 保持一致
function categoryValueField(key) {
  return 'id';
}

// 与 static-build.ts 的 contentCategoryValue 保持一致
function contentCategoryField(key, item) {
  return item.categoryId != null ? { categoryId: item.categoryId } : { groupName: item.groupName };
}

const modJson = await fetchJson('/core-modules');
const modules = (modJson?.data || modJson || []).filter((m) => m.status === 1);

const categories = {};
const content = {};

for (const m of modules) {
  const key = m.moduleKey;
  const hasFilter = isBuiltin(key) && key !== 'cases' ? true : !isBuiltin(key) && m.moduleType === 1;

  if (hasFilter) {
    const cj = await fetchJson(categoryEndpoint(key));
    const data = cj?.data || cj || [];
    const vf = categoryValueField(key);
    categories[key] = data
      .map((item) => ({ slug: item.slug || String(item[vf]), value: String(item[vf]) }))
      .filter((c) => c.slug && c.value);
  }

  const cj2 = await fetchJson(contentEndpoint(key));
  const records = cj2?.data?.records || cj2?.records || cj2?.data || [];
  content[key] = records
    .filter((r) => r.status === 1 && r.slug)
    .map((r) => ({ slug: r.slug, status: 1, ...contentCategoryField(key, r) }));
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  modules: modules.map((m) => ({
    moduleKey: m.moduleKey,
    moduleType: m.moduleType,
    path: m.path || '',
    status: m.status,
  })),
  categories,
  content,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`快照已写入 ${OUT_PATH}`);
console.log(`  模块: ${snapshot.modules.map((m) => m.moduleKey).join(', ')}`);
for (const key of Object.keys(snapshot.categories)) {
  console.log(`  分类 ${key}: ${snapshot.categories[key].length}`);
}
for (const key of Object.keys(snapshot.content)) {
  console.log(`  内容 ${key}: ${snapshot.content[key].length}`);
}
