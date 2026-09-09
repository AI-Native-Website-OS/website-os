import aiApi from './aiApi';
import type {
  SessionOut,
  SessionHistoryOut,
  SessionCreateRequest,
  ConfigOut,
  ConfigUpdateRequest,
  StatusOut,
  StatsOut,
  TokenLogEntryOut,
  MemorySearchOut,
  MemoryFileListOut,
  MemoryFileContentOut,
  MemoryFileSaveRequest,
  PromptConfigOut,
  PromptConfigSaveRequest,
  ModelConfigOut,
  ModelConfigSaveRequest,
  KnowledgeBaseOut,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseUpdateRequest,
  KnowledgeBaseListOut,
  KnowledgeDocumentOut,
  KnowledgeDocumentListOut,
  KnowledgeSearchRequest,
  KnowledgeSearchOut,
  KnowledgeProcessOut,
  KnowledgeReembedOut,
  RagConfigOut,
  RagConfigUpdateRequest,
} from '@/types';

export const aiService = {
  sessions: {
    list: () =>
      aiApi.get<SessionOut[]>('/sessions'),
    create: (data?: SessionCreateRequest) =>
      aiApi.post<SessionOut>('/sessions', data || {}),
    history: (sessionId: string) =>
      aiApi.get<SessionHistoryOut>(`/sessions/${sessionId}/history`),
    delete: (sessionId: string) =>
      aiApi.delete<StatusOut>(`/sessions/${sessionId}`),
  },

  config: {
    get: () =>
      aiApi.get<ConfigOut>('/config'),
    update: (data: ConfigUpdateRequest) =>
      aiApi.post<StatusOut>('/config', data),
  },

  models: {
    list: () =>
      aiApi.get<string[]>('/models'),
  },

  memory: {
    search: (keyword: string, username: string) =>
      aiApi.get<MemorySearchOut>('/memory/search', { params: { keyword, username } }),
    clear: () =>
      aiApi.delete<StatusOut>('/memory'),
    listFiles: () =>
      aiApi.get<MemoryFileListOut>('/memory/files'),
    getFile: (username: string, filename: string = 'MEMORY.md') =>
      aiApi.get<MemoryFileContentOut>('/memory/file', { params: { username, filename } }),
    saveFile: (username: string, data: MemoryFileSaveRequest, filename: string = 'MEMORY.md') =>
      aiApi.put<StatusOut>('/memory/file', data, { params: { username, filename } }),
  },

  stats: {
    get: (sessionId?: string) =>
      aiApi.get<StatsOut>('/stats', { params: { session_id: sessionId } }),
    tokenLogs: () =>
      aiApi.get<TokenLogEntryOut[]>('/token/logs'),
  },

  health: () =>
    aiApi.get<StatusOut>('/health'),

  promptConfig: {
    get: () =>
      aiApi.get<PromptConfigOut>('/prompt-config'),
    save: (data: PromptConfigSaveRequest) =>
      aiApi.post<StatusOut>('/prompt-config', data),
  },

  modelConfig: {
    get: () =>
      aiApi.get<ModelConfigOut>('/model-config'),
    save: (data: ModelConfigSaveRequest) =>
      aiApi.post<StatusOut>('/model-config', data),
    test: (modelType: string) =>
      aiApi.post<{ success: boolean; model_type: string; message: string; latency_ms: number }>('/model-config/test', { model_type: modelType }),
  },

  knowledge: {
    listKbs: () =>
      aiApi.get<KnowledgeBaseListOut>('/knowledge-bases'),
    getKb: (id: number) =>
      aiApi.get<KnowledgeBaseOut>(`/knowledge-bases/${id}`),
    createKb: (data: KnowledgeBaseCreateRequest) =>
      aiApi.post<KnowledgeBaseOut>('/knowledge-bases', data),
    updateKb: (id: number, data: KnowledgeBaseUpdateRequest) =>
      aiApi.put<KnowledgeBaseOut>(`/knowledge-bases/${id}`, data),
    deleteKb: (id: number) =>
      aiApi.delete<StatusOut>(`/knowledge-bases/${id}`),
    listDocuments: (kbId: number) =>
      aiApi.get<KnowledgeDocumentListOut>(`/knowledge-bases/${kbId}/documents`),
    uploadDocument: (kbId: number, formData: FormData) =>
      aiApi.post<KnowledgeDocumentOut>(`/knowledge-bases/${kbId}/documents/upload`, formData),
    deleteDocument: (docId: number) =>
      aiApi.delete<StatusOut>(`/documents/${docId}`),
    reprocess: (docId: number) =>
      aiApi.post<KnowledgeProcessOut>(`/documents/${docId}/process`),
    search: (data: KnowledgeSearchRequest) =>
      aiApi.post<KnowledgeSearchOut>('/knowledge/search', data),
    reembed: (kbId?: number) =>
      aiApi.post<KnowledgeReembedOut>('/knowledge/reembed', { kb_id: kbId }),
  },

  ragConfig: {
    get: () =>
      aiApi.get<RagConfigOut>('/rag-config'),
    update: (data: RagConfigUpdateRequest) =>
      aiApi.post<StatusOut>('/rag-config', data),
  },
};

export default aiService;
