import type { Metadata } from 'next';

export interface PageMeta {
  title: string;
  description?: string;
}

/**
 * 页面名称集中配置：路由 → 页面名称/描述。
 * 用于 generateMetadata 方案生成动态 title（由根布局 title.template 统一拼接）。
 * 新增页面只需在此登记，无需在每个组件中重复设置。
 * 说明：站点名称/描述/域名等品牌信息不在此硬编码，运行时由站点配置（system_configs.site_brand）
 * 与 SEO/GEO 配置（seo_configs）提供并即时生效。
 */
const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: '首页',
  },
  '/about': {
    title: '关于我们',
  },
  '/faqs': {
    title: '常见问题',
    description: '常见问题解答：了解产品功能、服务流程、技术支持和价格方案等常见问题。',
  },
  '/version': {
    title: '版本介绍',
    description: 'AI 企业官网不同版本的介绍与功能对比，选择适合您企业的版本。',
  },
  '/login': {
    title: '登录',
  },
  '/register': {
    title: '注册',
  },
  '/user-center': {
    title: '用户中心',
  },
  '/admin': { title: '后台管理' },
  '/admin/home': { title: '首页管理' },
  '/admin/modules': { title: '核心模块管理' },
  '/admin/about': { title: '关于管理' },
  '/admin/content': { title: '内容管理' },
  '/admin/faqs': { title: 'FAQ管理' },
  '/admin/leads': { title: '线索管理' },
  '/admin/seo': { title: 'SEO/GEO配置' },
  '/admin/users': { title: '账号管理' },
  '/admin/roles': { title: '角色管理' },
  '/admin/permissions': { title: '权限管理' },
  '/admin/settings': { title: '系统配置' },
  '/admin/ai-website': { title: '版本管理' },
  '/admin/api-docs': { title: '接口文档' },
  '/admin/stats': { title: '统计总览' },
  '/admin/stats/traffic': { title: '流量统计' },
  '/admin/stats/conversion': { title: '转化统计' },
  '/admin/stats/content': { title: '内容统计' },
  '/admin/stats/ai': { title: 'AI统计' },
  '/admin/ai': { title: 'AI管理' },
  '/admin/ai/knowledge': { title: '知识库管理' },
  '/admin/ai/memory': { title: '记忆系统' },
  '/admin/ai/chats': { title: '对话记录' },
  '/admin/ai/prompts': { title: '提示词配置' },
  '/admin/ai/model-config': { title: '模型参数配置' },
  '/admin/ai/suggestions': { title: '建议管理' },
};

export function pageMetadata(route: string): Metadata {
  const meta = PAGE_META[route];
  if (!meta) return {};
  return {
    title: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
  };
}

/**
 * 用于同时拥有子路由的中间段布局（如 /admin/ai、/admin/stats）：
 * 通过 default + template 同时给出本段页面标题并向下传递标题模板，
 * 避免子路由丢失根布局的标题模板。
 */
export function pageMetadataTemplate(route: string): Metadata {
  const meta = PAGE_META[route];
  if (!meta) return {};
  return {
    title: {
      default: meta.title,
      template: '%s',
    },
    ...(meta.description ? { description: meta.description } : {}),
  };
}
