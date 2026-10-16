import { secureRandomString } from '@/lib/utils';
import { t } from '@/i18n/translate';

export const MAX_CONTEXT_MESSAGES = 20;

const SESSION_STORAGE_KEY = 'sn_chat_session_id';

export function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + secureRandomString(9);
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const sid = generateSessionId();
  localStorage.setItem(SESSION_STORAGE_KEY, sid);
  return sid;
}

export function createNewSessionId(): string {
  const sid = generateSessionId();
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, sid);
  }
  return sid;
}

export function trimMessages<T>(messages: T[]): T[] {
  if (messages.length > MAX_CONTEXT_MESSAGES) {
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  }
  return messages;
}

export interface RestoredFile {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
}

export interface HistoryMessage {
  role: string;
  content: unknown;
  reasoning?: unknown;
  attachments?: Array<{ type?: string; name?: string; url?: string }>;
  images?: string[];
  display_content?: string;
  error?: unknown;
  timestamp?: number;
}

export interface RestoredMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  error?: { code?: string; detail?: string };
  files?: RestoredFile[];
}

function normalizeError(raw: unknown): { code?: string; detail?: string } | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return { detail: raw };
  if (typeof raw === 'object') {
    const e = raw as { code?: unknown; detail?: unknown };
    return {
      ...(typeof e.code === 'string' ? { code: e.code } : {}),
      ...(typeof e.detail === 'string' ? { detail: e.detail } : {}),
    };
  }
  return undefined;
}

export function mapHistoryToMessages(history: HistoryMessage[]): RestoredMessage[] {
  return history.map((m) => {
    const files: RestoredFile[] = [];
    if (Array.isArray(m.images)) {
      m.images.forEach((url, i) => {
        files.push({ id: `img_${i}`, type: 'image', url, name: t('libUi.chat.imageName', { n: i + 1 }) });
      });
    }
    if (Array.isArray(m.attachments)) {
      m.attachments.forEach((att, i) => {
        if (!att || typeof att !== 'object') return;
        if (att.type === 'image' && att.url) {
          files.push({ id: `att_img_${i}`, type: 'image', url: att.url, name: att.name || t('libUi.chat.image') });
        } else if (att.type === 'file') {
          files.push({ id: `att_file_${i}`, type: 'file', url: '', name: att.name || t('libUi.chat.file') });
        }
      });
    }
    const content = typeof m.display_content === 'string' && m.display_content
      ? m.display_content
      : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
    const error = normalizeError(m.error);
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content,
      ...(typeof m.reasoning === 'string' ? { reasoning: m.reasoning } : {}),
      ...(error ? { error } : {}),
      ...(files.length > 0 ? { files } : {}),
    };
  });
}
