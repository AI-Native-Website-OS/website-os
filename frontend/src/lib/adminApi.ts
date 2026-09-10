import api from './api';
import aiApi from './aiApi';
import aiService from './aiService';
import { ApiResponse, PageResult, User, Role, Permission, LoginResponse, DashboardStats, Lead, LeadFilterOptions, SyncProgress, Banner, SeoConfig, SeoDetail, SystemConfig, Faq, CoreModule, TrendPoint, HourlyPoint, NameValueItem, PageUrlItem, ContentCategory, MonthlyTrend, ChatTrend, HomeSection, AboutSection, ContactInfo, FooterConfig, ContentModuleCategory } from '@/types';

export const adminApi = {
  users: {
    list: (params: { page?: number; size?: number; role?: string; userType?: string; keyword?: string }) =>
      api.get<any, ApiResponse<PageResult<User>>>('/admin/users', { params }),
    get: (id: number) =>
      api.get<any, ApiResponse<User>>(`/admin/users/${id}`),
    create: (data: { username: string; password: string; email?: string; phone?: string; realName?: string; role: string; userType: string; department?: string }) =>
      api.post<any, ApiResponse<User>>('/admin/users', data),
    update: (id: number, data: { email?: string; phone?: string; realName?: string; role?: string; department?: string; status?: number }) =>
      api.put<any, ApiResponse<User>>(`/admin/users/${id}`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/users/${id}`),
    toggleStatus: (id: number) =>
      api.put<any, ApiResponse<User>>(`/admin/users/${id}/toggle-status`),
    resetPassword: (id: number, password: string) =>
      api.post<any, ApiResponse<void>>(`/admin/users/${id}/reset-password`, { password }),
  },

  roles: {
    list: () =>
      api.get<any, ApiResponse<Role[]>>('/admin/roles'),
    get: (code: string) =>
      api.get<any, ApiResponse<Role>>(`/admin/roles/${code}`),
    create: (data: { code: string; name: string; description?: string; userType?: string; sortOrder?: number }) =>
      api.post<any, ApiResponse<Role>>('/admin/roles', data),
    update: (code: string, data: { name?: string; description?: string; userType?: string; sortOrder?: number }) =>
      api.put<any, ApiResponse<Role>>(`/admin/roles/${code}`, data),
    delete: (code: string) =>
      api.delete<any, ApiResponse<void>>(`/admin/roles/${code}`),
  },
  permissions: {
    list: () =>
      api.get<any, ApiResponse<Permission[]>>('/admin/permissions'),
    getByRole: (role: string) =>
      api.get<any, ApiResponse<Permission[]>>(`/admin/permissions/role/${role}`),
    assign: (role: string, permissionIds: number[]) =>
      api.post<any, ApiResponse<void>>('/admin/permissions/assign', { role, permissionIds }),
  },

  leads: {
    list: (params: {
      page?: number; size?: number; status?: string; keyword?: string;
      sortBy?: string; sortOrder?: string; startDate?: string; endDate?: string;
      name?: string; company?: string; phone?: string; sourcePage?: string; ipAddress?: string; location?: string;
    }) => api.get<any, ApiResponse<PageResult<Lead>>>('/admin/leads', { params }),
    get: (id: number) =>
      api.get<any, ApiResponse<Lead>>(`/admin/leads/${id}`),
    update: (id: number, data: Partial<Lead>) =>
      api.put<any, ApiResponse<Lead>>(`/admin/leads/${id}`, data),
    updateStatus: (id: number, status: string) =>
      api.post<any, ApiResponse<void>>(`/admin/leads/${id}/status`, null, { params: { status } }),
    batchUpdateStatus: (ids: number[], status: string) =>
      api.post<any, ApiResponse<void>>('/admin/leads/batch-status', ids, { params: { status } }),
    batchDelete: (ids: number[]) =>
      api.post<any, ApiResponse<void>>('/admin/leads/batch-delete', ids),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/leads/${id}`),
    export: (params: { status?: string; startDate?: string; endDate?: string; keyword?: string }) =>
      api.get<any, ApiResponse<void>>('/admin/leads/export', { params }),
    filterOptions: () =>
      api.get<any, ApiResponse<LeadFilterOptions>>('/admin/leads/filter-options'),
  },

  banners: {
    list: () =>
      api.get<any, ApiResponse<Banner[]>>('/admin/pages/banners'),
    create: (data: Partial<Banner>) =>
      api.post<any, ApiResponse<Banner>>('/admin/pages/banners', data),
    update: (id: number, data: Partial<Banner>) =>
      api.put<any, ApiResponse<Banner>>(`/admin/pages/banners/${id}`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/pages/banners/${id}`),
  },

  seo: {
    list: () =>
      api.get<any, ApiResponse<SeoConfig[]>>('/admin/seo'),
    get: (id: number) =>
      api.get<any, ApiResponse<SeoConfig>>(`/admin/seo/${id}`),
    detail: (id: number) =>
      api.get<any, ApiResponse<SeoDetail>>(`/admin/seo/${id}/detail`),
    create: (data: Partial<SeoConfig>) =>
      api.post<any, ApiResponse<SeoConfig>>('/admin/seo', data),
    update: (id: number, data: Partial<SeoConfig>) =>
      api.put<any, ApiResponse<SeoConfig>>(`/admin/seo/${id}`, data),
    updateGeo: (id: number, data: Partial<SeoDetail>) =>
      api.put<any, ApiResponse<SeoDetail>>(`/admin/seo/${id}/geo`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/seo/${id}`),
    pages: (origin?: string) =>
      api.get<any, ApiResponse<Array<{ type: string; label: string; pageId: number | null; title: string; url: string }>>>('/admin/seo/pages', { params: origin ? { origin } : {} }),
    sync: (origin?: string) =>
      api.post<any, ApiResponse<{ taskId: string; status: string }>>('/admin/seo/sync', origin ? { origin } : {}),
    getSyncProgress: (taskId: string) =>
      api.get<any, ApiResponse<SyncProgress>>(`/admin/seo/sync-progress/${taskId}`),
    geoFiles: () =>
      api.get<any, ApiResponse<{ llmsTxt: string; llmsFullTxt: string; robotsTxt: string; sitemapXml: string }>>('/admin/seo/geo-files'),
    generateGeoFiles: () =>
      api.post<any, ApiResponse<Record<string, string>>>('/admin/seo/geo-files/generate'),
    geoConfig: () =>
      api.get<any, ApiResponse<{ intro: string; append: string }>>('/admin/seo/geo-config'),
    saveGeoConfig: (data: { intro?: string; append?: string }) =>
      api.post<any, ApiResponse<void>>('/admin/seo/geo-config', data),
  },

  stats: {
    dashboard: () =>
      api.get<any, ApiResponse<DashboardStats>>('/admin/stats/dashboard'),
    weeklyTrend: () =>
      api.get<any, ApiResponse<TrendPoint[]>>('/admin/stats/chart/weekly-trend'),
    hourlyDistribution: () =>
      api.get<any, ApiResponse<HourlyPoint[]>>('/admin/stats/chart/hourly-distribution'),
    pageTypeDistribution: () =>
      api.get<any, ApiResponse<NameValueItem[]>>('/admin/stats/chart/page-type-distribution'),
    pageUrlDistribution: () =>
      api.get<any, ApiResponse<PageUrlItem[]>>('/admin/stats/chart/page-url-distribution'),
    dailyViews: () =>
      api.get<any, ApiResponse<NameValueItem[]>>('/admin/stats/chart/daily-views'),
    leadSources: () =>
      api.get<any, ApiResponse<NameValueItem[]>>('/admin/stats/chart/lead-sources'),
    monthlyLeadTrend: () =>
      api.get<any, ApiResponse<MonthlyTrend[]>>('/admin/stats/chart/monthly-lead-trend'),
    monthlySubmissionTrend: () =>
      api.get<any, ApiResponse<MonthlyTrend[]>>('/admin/stats/chart/monthly-submission-trend'),
    weeklyChatTrend: () =>
      api.get<any, ApiResponse<ChatTrend[]>>('/admin/stats/chart/weekly-chat-trend'),
    contentCategories: () =>
      api.get<any, ApiResponse<ContentCategory[]>>('/admin/stats/chart/content-categories'),
    conversionFunnel: () =>
      api.get<any, ApiResponse<NameValueItem[]>>('/admin/stats/chart/conversion-funnel'),
    leadPipeline: () =>
      api.get<any, ApiResponse<{ stages: Array<{ status: string; label: string; count: number; recent: Array<{ id: number; name: string; company?: string; source: string; score: number }> }> }>>('/admin/stats/chart/lead-pipeline'),
  },

  envConfigs: {
    list: () =>
      api.get<any, ApiResponse<Array<{ key: string; value: string }>>>('/admin/system/env-configs'),
    update: (items: Array<{ key: string; value: string }>) =>
      api.put<any, ApiResponse<void>>('/admin/system/env-configs', items),
  },

  crypto: {
    publicKey: () =>
      api.get<any, ApiResponse<{ algorithm: string; publicKey: string }>>('/admin/system/crypto/public-key'),
  },

  systemConfigs: {
    list: () =>
      api.get<any, ApiResponse<SystemConfig[]>>('/admin/system-configs'),
    get: (key: string) =>
      api.get<any, ApiResponse<SystemConfig>>(`/admin/system-configs/${key}`),
    save: (data: Partial<SystemConfig>) =>
      api.post<any, ApiResponse<SystemConfig>>('/admin/system-configs', data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/system-configs/${id}`),
  },

  seoFiles: {
    getLlmsTxt: () =>
      api.get<any, ApiResponse<{ content: string; path: string }>>('/admin/system/files/llms-txt'),
    saveLlmsTxt: (content: string) =>
      api.post<any, ApiResponse<void>>('/admin/system/files/llms-txt', { content }),
    getLlmsFullTxt: () =>
      api.get<any, ApiResponse<{ content: string; path: string }>>('/admin/system/files/llms-full-txt'),
    saveLlmsFullTxt: (content: string) =>
      api.post<any, ApiResponse<void>>('/admin/system/files/llms-full-txt', { content }),
    getRobotsTxt: () =>
      api.get<any, ApiResponse<{ content: string; path: string }>>('/admin/system/files/robots-txt'),
    saveRobotsTxt: (content: string) =>
      api.post<any, ApiResponse<void>>('/admin/system/files/robots-txt', { content }),
    getSitemapXml: () =>
      api.get<any, ApiResponse<{ content: string; path: string }>>('/admin/system/files/sitemap-xml'),
    saveSitemapXml: (content: string) =>
      api.post<any, ApiResponse<void>>('/admin/system/files/sitemap-xml', { content }),
  },

  configFile: {
    get: () =>
      api.get<any, ApiResponse<{ content: string; path: string }>>('/admin/system/config-file'),
    save: (content: string) =>
      api.put<any, ApiResponse<void>>('/admin/system/config-file', { content }),
  },

  faqs: {
    list: (params: { page?: number; size?: number; keyword?: string; category?: string }) =>
      api.get<any, ApiResponse<PageResult<Faq>>>('/admin/faqs', { params }),
    create: (data: Partial<Faq>) =>
      api.post<any, ApiResponse<Faq>>('/admin/faqs', data),
    update: (id: number, data: Partial<Faq>) =>
      api.put<any, ApiResponse<Faq>>(`/admin/faqs/${id}`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/faqs/${id}`),
  },

  knowledge: {
    listBases: () =>
      aiApi.get('/memory/search', { params: { keyword: '', username: '' } }).then((r: any) => ({ data: [{ id: 1, name: '长期记忆库', description: 'AI 长期记忆存储，通过对话自动积累' }] })),
    createBase: (data: { name: string; description?: string }) =>
      Promise.resolve({ data: { id: Date.now(), name: data.name, description: data.description || '' } }),
    updateBase: (id: number, data: { name?: string; description?: string }) =>
      Promise.resolve({ data: null }),
    deleteBase: (id: number) =>
      aiService.memory.clear().then(() => ({ data: null })),
    listDocuments: (baseId: number) =>
      Promise.resolve({ data: [] }),
    uploadDocument: (baseId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return aiApi.post('/knowledge/bases/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).catch(() => ({ data: null }));
    },
    deleteDocument: (id: number) =>
      Promise.resolve({ data: null }),
    search: (kbId: number, query: string, limit?: number) =>
      aiService.memory.search(query, '').then((r: any) => ({ data: r.results || [] })),
    syncAll: () =>
      api.post<any, ApiResponse<{ total: number; success: number; fail: number }>>('/admin/ai/sync-all'),
    startSyncByType: (type: string) =>
      api.post<any, ApiResponse<{ taskId: string; status: string }>>('/admin/ai/sync-type', null, { params: { type } }),
    getSyncProgress: (taskId: string) =>
      api.get<any, ApiResponse<SyncProgress>>(`/admin/ai/sync-progress/${taskId}`),
  },

  relatedContent: {
    list: (params: { type: string; page?: number; size?: number; keyword?: string }) =>
      api.get<any, ApiResponse<PageResult<{ id: number; title: string; slug: string; summary: string; coverImage: string; type: string }>>>('/admin/related-content/list', { params }),
    batch: (params: { type: string; ids: string }) =>
      api.get<any, ApiResponse<Array<{ id: number; title: string; slug: string; summary: string; coverImage: string; type: string }>>>('/admin/related-content/batch', { params }),
  },

  forbiddenTopics: {
    list: () =>
      api.get<any, any>('/admin/forbidden-topics'),
    listEnabled: () =>
      api.get<any, any>('/admin/forbidden-topics/enabled'),
    get: (id: number) =>
      api.get<any, any>(`/admin/forbidden-topics/${id}`),
    create: (data: any) =>
      api.post<any, any>('/admin/forbidden-topics', data),
    update: (id: number, data: any) =>
      api.put<any, any>(`/admin/forbidden-topics/${id}`, data),
    delete: (id: number) =>
      api.delete<any, any>(`/admin/forbidden-topics/${id}`),
    listExamples: (topicId: number) =>
      api.get<any, any>(`/admin/forbidden-topics/${topicId}/examples`),
    createExample: (topicId: number, data: any) =>
      api.post<any, any>(`/admin/forbidden-topics/${topicId}/examples`, data),
    updateExample: (topicId: number, id: number, data: any) =>
      api.put<any, any>(`/admin/forbidden-topics/${topicId}/examples/${id}`, data),
    deleteExample: (topicId: number, id: number) =>
      api.delete<any, any>(`/admin/forbidden-topics/${topicId}/examples/${id}`),
    detect: (userInput: string) =>
      api.post<any, any>('/admin/forbidden-topics/detect', { user_input: userInput }),
  },

  contacts: {
    list: () =>
      api.get<any, ApiResponse<ContactInfo[]>>('/admin/contacts'),
    create: (data: { type: string; value: string; icon?: string; sortOrder?: number }) =>
      api.post<any, ApiResponse<ContactInfo>>('/admin/contacts', data),
    update: (id: number, data: { type: string; value: string; icon?: string; sortOrder?: number }) =>
      api.put<any, ApiResponse<ContactInfo>>(`/admin/contacts/${id}`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/contacts/${id}`),
  },

  homeSections: {
    list: () => api.get<any, ApiResponse<HomeSection[]>>('/admin/home/sections'),
    get: (id: number) => api.get<any, ApiResponse<HomeSection>>(`/admin/home/sections/${id}`),
    create: (data: Partial<HomeSection>) => api.post<any, ApiResponse<HomeSection>>('/admin/home/sections', data),
    update: (id: number, data: Partial<HomeSection>) => api.put<any, ApiResponse<HomeSection>>(`/admin/home/sections/${id}`, data),
    delete: (id: number) => api.delete<any, ApiResponse<void>>(`/admin/home/sections/${id}`),
    reorder: (ids: number[]) => api.put<any, ApiResponse<void>>('/admin/home/sections/reorder', { ids }),
  },

  coreModules: {
    list: (params: { page?: number; size?: number; keyword?: string }) =>
      api.get<any, ApiResponse<PageResult<CoreModule>>>('/admin/core-modules', { params }),
    all: () =>
      api.get<any, ApiResponse<CoreModule[]>>('/admin/core-modules/all'),
    get: (id: number) =>
      api.get<any, ApiResponse<CoreModule>>(`/admin/core-modules/${id}`),
    create: (data: Partial<CoreModule>) =>
      api.post<any, ApiResponse<CoreModule>>('/admin/core-modules', data),
    update: (id: number, data: Partial<CoreModule>) =>
      api.put<any, ApiResponse<CoreModule>>(`/admin/core-modules/${id}`, data),
    delete: (id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/core-modules/${id}`),
    reorder: (ids: number[]) =>
      api.put<any, ApiResponse<void>>('/admin/core-modules/reorder', { ids }),
    batchStatus: (ids: number[], status: number) =>
      api.post<any, ApiResponse<void>>('/admin/core-modules/batch-status', { ids, status }),
  },

  content: {
    list: (moduleKey: string, params: { page?: number; size?: number; keyword?: string; categoryId?: number }) =>
      api.get<any, ApiResponse<PageResult<any>>>(`/admin/content/${moduleKey}`, { params }),
    get: (moduleKey: string, id: number) =>
      api.get<any, ApiResponse<any>>(`/admin/content/${moduleKey}/${id}`),
    create: (moduleKey: string, data: any) =>
      api.post<any, ApiResponse<any>>(`/admin/content/${moduleKey}`, data),
    update: (moduleKey: string, id: number, data: any) =>
      api.put<any, ApiResponse<any>>(`/admin/content/${moduleKey}/${id}`, data),
    delete: (moduleKey: string, id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/content/${moduleKey}/${id}`),
    batchDelete: (moduleKey: string, ids: number[]) =>
      api.post<any, ApiResponse<void>>(`/admin/content/${moduleKey}/batch-delete`, ids),
    batchStatus: (moduleKey: string, ids: number[], status: number) =>
      api.post<any, ApiResponse<void>>(`/admin/content/${moduleKey}/batch-status`, { ids, status }),
  },

  contentCategories: {
    list: (moduleKey: string) =>
      api.get<any, ApiResponse<ContentModuleCategory[]>>(`/admin/content/${moduleKey}/categories`),
    get: (moduleKey: string, id: number) =>
      api.get<any, ApiResponse<ContentModuleCategory>>(`/admin/content/${moduleKey}/categories/${id}`),
    create: (moduleKey: string, data: Partial<ContentModuleCategory>) =>
      api.post<any, ApiResponse<ContentModuleCategory>>(`/admin/content/${moduleKey}/categories`, data),
    update: (moduleKey: string, id: number, data: Partial<ContentModuleCategory>) =>
      api.put<any, ApiResponse<ContentModuleCategory>>(`/admin/content/${moduleKey}/categories/${id}`, data),
    delete: (moduleKey: string, id: number) =>
      api.delete<any, ApiResponse<void>>(`/admin/content/${moduleKey}/categories/${id}`),
    reorder: (moduleKey: string, ids: number[]) =>
      api.put<any, ApiResponse<void>>(`/admin/content/${moduleKey}/categories/reorder`, { ids }),
  },

  homeFooter: {
    get: () => api.get<any, ApiResponse<SystemConfig>>('/admin/home/footer'),
    save: (data: FooterConfig) => api.put<any, ApiResponse<SystemConfig>>('/admin/home/footer', data),
  },

  aboutSections: {
    list: () => api.get<any, ApiResponse<AboutSection[]>>('/admin/about/sections'),
    get: (id: number) => api.get<any, ApiResponse<AboutSection>>(`/admin/about/sections/${id}`),
    create: (data: Partial<AboutSection>) => api.post<any, ApiResponse<AboutSection>>('/admin/about/sections', data),
    update: (id: number, data: Partial<AboutSection>) => api.put<any, ApiResponse<AboutSection>>(`/admin/about/sections/${id}`, data),
    delete: (id: number) => api.delete<any, ApiResponse<void>>(`/admin/about/sections/${id}`),
    reorder: (ids: number[]) => api.put<any, ApiResponse<void>>('/admin/about/sections/reorder', { ids }),
  },

  ai: {
    getConversations: (params: { page?: number; size?: number }) =>
      aiService.sessions.list().then((r: any) => ({ data: r, total: 0 })),
    getMessages: (sessionId: string) =>
      aiService.sessions.history(sessionId).then((r: any) => r.messages || r),
    getConfig: () =>
      aiService.config.get(),
    updateConfig: (data: any) =>
      aiService.config.update(data),
    searchMemory: (keyword: string) =>
      aiService.memory.search(keyword, ''),
    clearMemory: () =>
      aiService.memory.clear(),
    getStats: (sessionId?: string) =>
      aiService.stats.get(sessionId),
    getTokenLogs: () =>
      aiService.stats.tokenLogs(),
    listModels: () =>
      aiService.models.list(),
    getFacts: () =>
      api.get<any, any>('/admin/facts'),
    createFact: (data: any) =>
      api.post<any, any>('/admin/facts', data),
    updateFact: (id: number, data: any) =>
      api.put<any, any>(`/admin/facts/${id}`, data),
    deleteFact: (id: number) =>
      api.delete<any, any>(`/admin/facts/${id}`),
  },
};
