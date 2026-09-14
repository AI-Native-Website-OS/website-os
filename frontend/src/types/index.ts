export interface ContentModuleCategory {
  id: number;
  moduleKey: string;
  name: string;
  slug?: string;
  description?: string;
  coverImage?: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}

export interface ContentItem {
  id: number;
  moduleKey: string;
  title: string;
  slug: string;
  categoryId?: number | null;
  groupName?: string;
  summary?: string;
  content?: string;
  coverImage?: string;
  coverScale?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  sortOrder: number;
  status: number;
  isTop?: number;
  scheduledAt?: string | null;
  publishedAt?: string;
  author?: string;
  source?: string;
  downloadCount?: number;
  requireForm?: number;
  seoTitle?: string;
  seoDescription?: string;
  viewCount?: number;
  extraData?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CoreModule {
  id: number;
  moduleKey: string;
  moduleName: string;
  moduleTitle?: string;
  moduleDescription?: string;
  moduleType: number;
  path?: string;
  sortOrder: number;
  status: number;
  moduleColumns?: number;
  createdAt: string;
}

export interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string;
  productId: number;
  sortOrder: number;
  status: number;
  viewCount: number;
  createdAt: string;
}

export interface Lead {
  id: number;
  name: string;
  company: string;
  phone: string;
  email?: string;
  source: string;
  sourcePage?: string;
  ipAddress?: string;
  country?: string;
  province?: string;
  city?: string;
  interestArea?: string;
  requirement?: string;
  enterpriseType?: string;
  businessDirection?: string;
  projectRequirement?: string;
  projectTimeline?: string;
  score: number;
  status: string;
  assignedTo?: number;
  followUpNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SyncProgress {
  taskId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  total: number;
  current: number;
  success: number;
  fail: number;
  currentItem: string;
  errorMessage: string;
  percent: number;
}

export interface LeadFilterOptions {
  names: string[];
  companies: string[];
  phones: string[];
  sourcePages: string[];
  ips: string[];
  locations: string[];
}

export interface HomeSection {
  id: number;
  sectionType: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  url: string;
  extraData: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}

export interface AboutSection {
  id: number;
  sectionType: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  extraData: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  linkUrl: string;
  sortOrder: number;
  status: number;
}

export interface Partner {
  id: number;
  name: string;
  logo: string;
  websiteUrl: string;
  sortOrder: number;
  status: number;
}

export interface IndustryChain {
  id: number;
  name: string;
  parentId: number;
  icon: string;
  description: string;
  linkUrl: string;
  sortOrder: number;
  status: number;
  children?: IndustryChain[];
}

export interface ContentRecommendation {
  id: number;
  moduleKey: string;
  moduleName: string;
  title: string;
  slug: string;
}

export interface AiChatMessage {
  sessionId: string;
  message: string;
  recommendations?: {
    items?: ContentRecommendation[];
    action?: 'showForm';
    actionData?: { mode?: string; requirement?: string };
  };
}

export interface DashboardStats {
  todayViews: number;
  todayUniqueVisitors: number;
  todayLeads: number;
  totalResources: number;
  todayAiChats: number;
  todayFormSubmits: number;
  todayDownloads: number;
  topPages: Array<{ pageType: string; pageId: number; pageUrl: string; pageTitle?: string; viewCount: number }>;
}

export interface SeoConfig {
  id: number;
  pageType?: string;
  pageId?: number | null;
  title: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robots?: string;
  ogType?: string;
  geoSummary?: string;
  enabled?: number;
  geoOptional?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeoKeywordItem {
  id?: number;
  keyword: string;
  category?: string;
  intentNote?: string;
  sortOrder?: number;
}

export interface SeoFaqItem {
  id?: number;
  question: string;
  answer?: string;
  sortOrder?: number;
}

export interface SeoDetail {
  id: number;
  pageType?: string;
  pageId?: number | null;
  title: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robots?: string;
  ogType?: string;
  geoSummary?: string;
  enabled?: number;
  geoOptional?: number;
  keywordsList?: SeoKeywordItem[];
  faqs?: SeoFaqItem[];
}

export interface SystemConfig {
  id: number;
  configKey: string;
  configValue: string;
  configType: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInfo {
  id: number;
  type: string;
  value: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FooterExtraItem {
  label: string;
  value: string;
}

export interface FooterConfig {
  logo: string;
  copyright: string;
  policeIcon: string;
  icpNumber: string;
  icpUrl: string;
  policeNumber: string;
  policeUrl: string;
  extra: FooterExtraItem[];
}

export interface PageResult<T> {
  total: number;
  pages: number;
  current: number;
  size: number;
  records: T[];
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  realName: string;
  companyName?: string;
  avatar: string;
  status: number;
  role: string;
  userType: string;
  department: string;
  lastLoginTime: string;
  createdAt: string;
  permissions: string[];
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  permissions: string[];
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface Role {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrendPoint {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
}

export interface HourlyPoint {
  hour: number;
  visits: number;
}

export interface NameValueItem {
  name: string;
  value: number;
}

export interface PageUrlItem {
  pageUrl: string;
  pageType: string;
  visits: number;
  pageTitle?: string;
}

export interface ContentCategory {
  name: string;
  count: number;
  views: number;
}

export interface MonthlyTrend {
  month: string;
  leads: number;
  submits: number;
}

export interface ChatTrend {
  date: string;
  chats: number;
  users: number;
}

export interface ContentRelations {
  [moduleKey: string]: ContentItem[];
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  NORMAL_USER: '普通用户',
  VISITOR: '游客',
};

export const USER_TYPE_LABELS: Record<string, string> = {
  INTERNAL: '内部用户',
  EXTERNAL: '外部用户',
};

export interface AboutPageContent {
  heroDescription: string;
  missionTitle: string;
  missionDescription: string;
  visionItems: string[];
  stats: Array<{ number: string; label: string }>;
  values: Array<{ icon: string; title: string; description: string }>;
  capabilities: Array<{ icon: string; title: string; description: string }>;
  milestones: Array<{ year: string; title: string; description: string }>;
}

export interface AiWebsiteVersionItem {
  key: string;
  name: string;
  tagline?: string;
  price?: string;
  priceNote?: string;
  description?: string;
  features?: string[];
  highlight?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface AiWebsiteComparisonRow {
  feature: string;
  values: Record<string, string>;
}

export interface AiWebsiteConfig {
  title?: string;
  subtitle?: string;
  versions?: AiWebsiteVersionItem[];
  comparisonTitle?: string;
  comparisonRows?: AiWebsiteComparisonRow[];
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: number;
  knowledgeBaseId: number;
  title: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  content: string;
  sourceType: string;
  sourceId: number;
  status: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

// AI Consultant API v1.0 types
export interface SessionOut {
  session_id: string;
  title: string;
  username?: string;
  message_count: number;
  created_at: string;
  last_active: string;
}

export interface AttachmentOut {
  type: 'image' | 'file';
  name?: string;
  url?: string;
}

export interface MessageOut {
  role: string;
  content: any;
  reasoning?: any;
  attachments?: AttachmentOut[];
  images?: string[];
  display_content?: string;
  timestamp?: number;
}

export interface SessionHistoryOut {
  session_id: string;
  messages: MessageOut[];
}

export interface SessionCreateRequest {
  title?: string;
  system_prompt?: string;
  model?: string;
}

export interface ConfigOut {
  llm_provider?: string | null;
  llm_base_url?: string | null;
  llm_model?: string | null;
  system_prompt?: string;
  llm_temperature: number;
  llm_max_tokens: number;
  llm_top_p: number;
  llm_frequency_penalty: number;
  llm_presence_penalty: number;
  llm_stop?: string[] | null;
  llm_seed?: number | null;
  llm_thinking_auto_collapse: boolean;
  ai_user_rate_limit: number;
  ai_guest_daily_limit: number;
  embedding_provider?: string | null;
  embedding_base_url?: string | null;
  embedding_model?: string | null;
  embedding_dimension?: number | null;
  vl_provider?: string | null;
  vl_base_url?: string | null;
  vl_model?: string | null;
  vl_temperature: number;
  vl_max_tokens: number;
  vl_image_size: string;
  vl_image_quality: string;
  reranker_provider?: string | null;
  reranker_base_url?: string | null;
  reranker_model?: string | null;
  reranker_enabled: boolean;
  reranker_top_k: number;
}

export interface ConfigUpdateRequest {
  provider?: string | null;
  base_url?: string | null;
  api_key?: string | null;
  model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  stop?: string | null;
  seed?: number | null;
  thinking_keyword?: string | null;
  thinking_auto_collapse?: boolean | null;
  system_prompt?: string | null;
  session_auto_save?: boolean | null;
  session_dir?: string | null;
  session_max_history?: number | null;
  memory_short_term_size?: number | null;
  memory_long_term_enabled?: boolean | null;
  memory_long_term_file?: string | null;
  token_log_enabled?: boolean | null;
  token_log_file?: string | null;
}

export interface StatusOut {
  status: string;
  message: string;
}

export interface StatsOut {
  prompt: number;
  completion: number;
  total: number;
}

export interface TokenLogEntryOut {
  timestamp: string;
  session_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface MemorySearchOut {
  results: Record<string, any>[];
}

export interface MemoryFileInfo {
  username: string;
  filename: string;
  size: number;
  line_count: number;
  updated_at: string;
}

export interface MemoryFileListOut {
  files: MemoryFileInfo[];
}

export interface MemoryFileContentOut {
  username: string;
  filename: string;
  content: string;
}

export interface MemoryFileSaveRequest {
  content: string;
}

export interface PromptConfigOut {
  system_prompt: string;
  suggestions: string[];
  banned_words: string[];
  banned_threshold: number;
  welcome_message?: string;
  input_placeholder?: string;
}

export interface PromptConfigSaveRequest {
  system_prompt: string;
  suggestions: string[];
  banned_words: string[];
  banned_threshold?: number;
  welcome_message?: string;
  input_placeholder?: string;
}

export interface ModelConfigItem {
  key: string;
  value: string;
}

export interface ModelConfigOut {
  items: ModelConfigItem[];
}

export interface ModelConfigSaveRequest {
  items: ModelConfigItem[];
}


// ── 知识库 ───────────────────────────────────────────────

export interface KnowledgeBaseOut {
  id: number;
  name: string;
  description: string;
  status: number;
  // 分块配置
  chunk_size: number;
  chunk_overlap: number;
  chunk_separator: string;
  // 文本预处理
  text_preprocessing_rules: string[];
  // 嵌入模型
  embedding_model: string;
  embedding_dimension: number;
  // 检索
  top_k: number;
  threshold_min: number;
  threshold_max: number;
  // 重排
  reranker_model: string;
  reranker_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseListOut {
  items: KnowledgeBaseOut[];
}

export interface KnowledgeBaseCreateRequest {
  name: string;
  description?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  chunk_separator?: string;
  text_preprocessing_rules?: string[];
  embedding_model?: string;
  embedding_dimension?: number;
  top_k?: number;
  threshold_min?: number;
  threshold_max?: number;
  reranker_model?: string;
  reranker_enabled?: boolean;
}

export interface KnowledgeBaseUpdateRequest {
  name?: string;
  description?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  chunk_separator?: string;
  text_preprocessing_rules?: string[];
  embedding_model?: string;
  embedding_dimension?: number;
  top_k?: number;
  threshold_min?: number;
  threshold_max?: number;
  reranker_model?: string;
  reranker_enabled?: boolean;
}

export interface KnowledgeDocumentOut {
  id: number;
  knowledge_base_id: number;
  title: string;
  file_name: string;
  file_size: number;
  status: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentListOut {
  items: KnowledgeDocumentOut[];
}

export interface KnowledgeChunkOut {
  id: number;
  content: string;
  media_type?: string;
  chunk_index: number;
  tokens: number;
  document_id: number;
  doc_title: string;
  similarity: number;
}

export interface KnowledgeSearchRequest {
  query: string;
  kb_id?: number;
  top_k?: number;
  threshold?: number;
  max_threshold?: number;
}

export interface KnowledgeSearchOut {
  results: KnowledgeChunkOut[];
}

export interface KnowledgeProcessOut {
  status: string;
  message: string;
  chunks: number;
  document_id: number;
}

export interface KnowledgeReembedOut {
  status: string;
  reembedded: number;
}

// ── RAG 配置 ─────────────────────────────────────────────

export interface RagConfigOut {
  enabled: boolean;
  kb_ids: number[];
  top_k: number;
  threshold: number;
  max_threshold: number;
  reranker_enabled: boolean;
  reranker_model: string;
}

export interface RagConfigUpdateRequest {
  enabled?: boolean;
  kb_ids?: number[];
  top_k?: number;
  threshold?: number;
  max_threshold?: number;
  reranker_enabled?: boolean;
  reranker_model?: string;
}
