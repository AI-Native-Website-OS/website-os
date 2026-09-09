import type { Metadata } from 'next';

export interface PageMeta {
  title: string;
  description?: string;
}

/**
 * 页面名称集中配置：路由 → 页面名称/描述。
 * 用于 generateMetadata 方案生成动态 title（格式：页面名称 - 圣诺江苏官网，
 * 由根布局 title.template 统一拼接）。新增页面只需在此登记，无需在每个组件中重复设置。
 */
const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: '首页',
    description: '圣诺联合是中国领先的企业数字基础设施服务商，为中国政府、国企和企业客户提供智慧招采平台、可信数据空间、分布式数据治理、区块链可信基础设施和AI智能体应用等企业数字基础设施解决方案。',
  },
  '/about': {
    title: '关于我们',
    description: '河北圣诺联合科技有限公司——企业数字基础设施服务商',
  },
  '/faqs': {
    title: '常见问题',
    description: '圣诺联合常见问题解答：了解产品功能、服务流程、技术支持和价格方案等常见问题。',
  },
  '/version': {
    title: '版本介绍',
    description: 'AI 企业官网不同版本的介绍与功能对比，选择适合您企业的版本。',
  },
  '/login': {
    title: '登录',
    description: '登录圣诺联合账号，访问采购平台、数据空间、AI 应用等企业数字基础设施服务。',
  },
  '/register': {
    title: '注册',
    description: '注册圣诺联合账号，获取智慧招采、可信数据空间、AI 应用等企业数字化服务。',
  },
  '/user-center': {
    title: '用户中心',
    description: '圣诺联合用户中心',
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
 * 避免子路由丢失 “- 圣诺江苏官网” 后缀。
 */
export function pageMetadataTemplate(route: string): Metadata {
  const meta = PAGE_META[route];
  if (!meta) return {};
  return {
    title: {
      default: meta.title,
      template: '%s - 圣诺江苏官网',
    },
    ...(meta.description ? { description: meta.description } : {}),
  };
}
