'use client';

import React, { useEffect, useState, useRef } from 'react';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { motion } from 'framer-motion';

import {

  Send, Bot, Sparkles, ArrowRight, ChevronRight, CheckCircle,

  Database, Shield, Cpu, Globe, TrendingUp, Target, BookOpen,

  Award, FileText, Quote, Layers, Lightbulb, Building2, X, Paperclip, Brain, SquarePen, Square,

} from 'lucide-react';

import api from '@/lib/api';

import { aiService } from '@/lib/aiService';

import config from '@/config';

import { useI18n } from '@/i18n/I18nProvider';

import { formatDate, getImageUrl, shuffleArray, secureRandomString } from '@/lib/utils';

import {
  getVisitorId, getGuestQuota, setGuestQuota, recordGuestUse, checkUserRateLimit,
  DEFAULT_USER_RATE_LIMIT, DEFAULT_GUEST_DAILY_LIMIT,
} from '@/lib/aiQuota';

import { isValidPhone, isValidEmail } from '@/lib/validators';

import { moduleHref, detailUrl, listUrl, categoryUrl } from '@/lib/moduleConfig';
import Footer from '@/components/Footer';

import SeoHead from '@/components/SeoHead';

import ParticleBackground from '@/components/ParticleBackground';

import { generateSoftwareApplicationSchema, toSiteIdentity } from '@/lib/seo';

import { useAuth } from '@/hooks/useAuth';
import { useSiteConfig } from '@/hooks/useSiteConfig';

import Markdown from '@/components/Markdown';

import { getOrCreateSessionId, createNewSessionId, trimMessages, mapHistoryToMessages, MAX_CONTEXT_MESSAGES } from '@/lib/chatHistory';
import { parseDocumentFile } from '@/lib/fileParser';

import type { HomeSection, CoreModule, ContentItem, ContentModuleCategory } from '@/types';
import { BlockRenderer } from '@/components/BlockRenderer';

interface ChatFile {

  id: string;

  type: 'image' | 'audio' | 'file';

  url: string;

  name: string;

  textContent?: string;

  rawBase64?: string;

  parseError?: string;

}

interface Message {

  role: 'user' | 'assistant';

  content: string;

  reasoning?: string;

  stopped?: boolean;

  files?: ChatFile[];
  recommendations?: {

    action?: 'showForm';

    actionData?: { mode?: string; requirement?: string };

  };

}

const iconMap: Record<string, any> = {

  Database, Globe, Shield, Cpu, Layers, Lightbulb, Target, Award, BookOpen, TrendingUp,

};

// 根据核心模块配置返回首页网格列数类名（默认 4 列）
const moduleColClass = (m?: CoreModule): string => {
  const n = m?.moduleColumns && m.moduleColumns >= 1 && m.moduleColumns <= 6 ? m.moduleColumns : 4;
  const map: Record<number, string> = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
  };
  return map[n] || 'lg:grid-cols-4';
};

// 首页核心模块区块内容展示上限：每模块固定展示 4 条，超出不展示，避免页面拉伸变形
const moduleRowLimit = (_m?: CoreModule): number => 4;

// 首页区块斑马纹背景：按渲染位置奇偶交替
const sectionBg = (i: number): string => (i % 2 === 0 ? 'bg-gray-50' : 'bg-white');

const formTitles: Record<string, string> = {
  'login-prompt': '温馨提示',
  demo: '预约产品演示',
  solution: '获取解决方案',
};

const formSubmitText: Record<string, string> = {
  demo: '提交预约',
  solution: '立即获取',
};

const buildUserInput = (text: string, files: ChatFile[]): string => {
  const textFiles = files.filter(f => f.type === 'file' && f.textContent);
  if (textFiles.length === 0) return text;
  const parts = textFiles.map(f => `以下是我上传的文件${f.name}的内容：\n\`\`\`\n${f.textContent}\n\`\`\``);
  return parts.join('\n\n') + `\n\n${text || '请分析这个文件'}`;
};

const buildChatBody = (user: any, userInput: string, sessionId: string, visitorId: string, text: string, files: ChatFile[]): Record<string, any> => {
  const chatBody: Record<string, any> = {
    user_input: userInput,
    session_id: sessionId,
    username: user?.realName || user?.username || '',
    original_input: text || (files.length > 0 ? '查看附件' : ''),
    visitor_id: visitorId || getVisitorId(),
  };
  if (files.length > 0) {
    const imgUrls = files.filter(f => f.type === 'image').map(f => f.url);
    if (imgUrls.length > 0) chatBody.images = imgUrls;
    const fileAtts = files.filter(f => f.type === 'file').map(f => ({ type: 'file', name: f.name, ...(f.rawBase64 ? { base64: f.rawBase64 } : {}) }));
    if (fileAtts.length > 0) chatBody.attachments = fileAtts;
  }
  return chatBody;
};

const isSendBlocked = (
  user: any,
  guestLocked: boolean,
  aiLimits: { userLimit: number; guestLimit: number },
  setGuestLocked: (v: boolean) => void,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
): boolean => {
  if (user) {
    const rl = checkUserRateLimit(aiLimits.userLimit);
    if (!rl.allowed) {
      setMessages(prev => [...prev, { role: 'assistant', content: `请求过于频繁，请稍后再试（每分钟最多 ${aiLimits.userLimit} 次）。` }]);
      return true;
    }
    return false;
  }
  if (guestLocked) return true;
  if (getGuestQuota() >= aiLimits.guestLimit) {
    setGuestLocked(true);
    return true;
  }
  return false;
};

const pushAssistant = (prev: Message[], content: string): Message[] => [...prev, { role: 'assistant', content }];

const appendReasoning = (prev: Message[], content: string): Message[] => {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, reasoning: (last.reasoning || '') + content };
  } else {
    updated.push({ role: 'assistant', content: '', reasoning: content } as Message);
  }
  return updated;
};

const appendContent = (prev: Message[], content: string): Message[] => {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, content: (last.content || '') + content };
  } else {
    updated.push({ role: 'assistant', content } as Message);
  }
  return updated;
};

const finalizeAssistant = (prev: Message[], parsed: any): Message[] => {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, content: parsed.content || last.content, reasoning: parsed.reasoning || last.reasoning, recommendations: parsed.recommendations, stopped: !!parsed.stopped };
  } else {
    updated.push({ role: 'assistant', content: parsed.content || '', reasoning: parsed.reasoning, recommendations: parsed.recommendations, stopped: !!parsed.stopped } as Message);
  }
  return updated;
};

const buildRequirementText = (mode: string): string => {
  if (mode === 'demo') return '产品演示预约（AI对话提交）';
  if (mode === 'solution') return '解决方案咨询（AI对话提交）';
  return '案例咨询（AI对话提交）';
};

// 打字机效果：流式/一次性拿到全文时都按固定节奏逐字显示，保证可见的逐字输出。
function TypewriterMarkdown({ content, streaming, onTick }: { content: string; streaming: boolean; onTick?: () => void }) {
  const [shown, setShown] = useState<number>(() => (streaming ? 0 : content.length));
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  useEffect(() => {
    if (!streaming) {
      setShown(content.length);
      return;
    }
    if (shown >= content.length) return;
    const timer = setTimeout(() => {
      setShown(prev => Math.min(content.length, prev + 4));
      onTickRef.current?.();
    }, 20);
    return () => clearTimeout(timer);
  }, [streaming, shown, content]);
  return <Markdown content={content.slice(0, shown)} />;
}

interface ChatStreamContext {
  user: any;
  aiLimits: { userLimit: number; guestLimit: number };
  setGuestLocked: (v: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setFormMode: (m: string) => void;
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; company: string; phone: string; email: string; requirement: string }>>;
  setShowForm: (v: boolean) => void;
  submitLead: (mode: string, requirement?: string) => void;
  markStopped: () => void;
}

const handleLimitEvent = (parsed: any, ctx: ChatStreamContext) => {
  if (parsed.reason === 'guest_limit') {
    setGuestQuota(ctx.aiLimits.guestLimit);
    ctx.setGuestLocked(true);
    ctx.setMessages(prev => pushAssistant(prev, parsed.message || '您今日的免费咨询次数已用完，请登录后继续使用AI顾问。'));
  } else {
    ctx.setMessages(prev => pushAssistant(prev, parsed.message || '请求过于频繁，请稍后再试。'));
  }
};

const maybeRecordGuestUse = (ctx: ChatStreamContext, guestUsed: boolean): boolean => {
  if (!ctx.user && !guestUsed) {
    recordGuestUse();
    return true;
  }
  return guestUsed;
};

const handleRecommendations = (parsed: any, ctx: ChatStreamContext) => {
  if (parsed.recommendations?.action === 'showForm' && parsed.recommendations?.actionData?.mode) {
    const { mode, requirement } = parsed.recommendations.actionData;
    if (ctx.user) {
      setTimeout(() => ctx.submitLead(mode, requirement), 500);
    } else {
      ctx.setFormMode(mode);
      ctx.setFormData(prev => ({
        ...prev,
        requirement: requirement || buildRequirementText(mode),
      }));
      ctx.setShowForm(true);
    }
  }
};

const handleStreamEvent = (parsed: any, ctx: ChatStreamContext, guestUsed: boolean): { used: boolean; stop: boolean } => {
  if (parsed.type === 'limit') {
    handleLimitEvent(parsed, ctx);
    return { used: guestUsed, stop: true };
  }
  if (parsed.type === 'error') {
    ctx.setMessages(prev => pushAssistant(prev, '抱歉，AI顾问暂时无法回答。请稍后再试。'));
    return { used: guestUsed, stop: true };
  }
  if (parsed.type === 'reasoning' && parsed.content) {
    const used = maybeRecordGuestUse(ctx, guestUsed);
    ctx.setMessages(prev => appendReasoning(prev, parsed.content));
    return { used, stop: false };
  }
  if (parsed.type === 'content' && parsed.content) {
    const used = maybeRecordGuestUse(ctx, guestUsed);
    ctx.setMessages(prev => appendContent(prev, parsed.content));
    return { used, stop: false };
  }
  if (parsed.type === 'done') {
    const used = maybeRecordGuestUse(ctx, guestUsed);
    ctx.setMessages(prev => finalizeAssistant(prev, parsed));
    handleRecommendations(parsed, ctx);
    return { used, stop: false };
  }
  return { used: guestUsed, stop: false };
};

const consumeStreamLines = (lines: string[], ctx: ChatStreamContext, guestUsed: boolean): boolean => {
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(line.substring(6));
    } catch {
      continue;
    }
    const res = handleStreamEvent(parsed, ctx, guestUsed);
    guestUsed = res.used;
    if (res.stop) break;
  }
  return guestUsed;
};

const processSseStream = async (body: ReadableStream<Uint8Array>, controller: AbortController, ctx: ChatStreamContext): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let guestUsed = false;
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e: any) {
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        ctx.markStopped();
      }
      break;
    }
    const { done, value } = chunk;
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    guestUsed = consumeStreamLines(lines, ctx, guestUsed);
  }
};

const handleJsonResponse = async (resp: Response, ctx: ChatStreamContext): Promise<void> => {
  const json = await resp.json();
  if (json.type === 'limit') {
    if (json.reason === 'guest_limit') {
      setGuestQuota(ctx.aiLimits.guestLimit);
      ctx.setGuestLocked(true);
      ctx.setMessages(prev => pushAssistant(prev, json.message || '您今日的免费咨询次数已用完，请登录后继续使用AI顾问。'));
    } else {
      ctx.setMessages(prev => pushAssistant(prev, json.message || '请求过于频繁，请稍后再试。'));
    }
    return;
  }
  if (!ctx.user) recordGuestUse();
  const fullText = json.content || json.message || '感谢您的提问。我们的专业顾问会尽快为您解答。';
  ctx.setMessages(prev => [...prev, { role: 'assistant' as const, content: fullText, reasoning: json.reasoning, recommendations: json.recommendations }]);
  if (json.recommendations?.action === 'showForm' && json.recommendations?.actionData?.mode) {
    const { mode, requirement } = json.recommendations.actionData;
    if (ctx.user) {
      setTimeout(() => ctx.submitLead(mode, requirement), 500);
    } else {
      ctx.setFormMode(mode);
      ctx.setFormData(prev => ({
        ...prev,
        requirement: requirement || buildRequirementText(mode),
      }));
      ctx.setShowForm(true);
    }
  }
};



export default function HomePage() {

  const { user } = useAuth();

  const { siteConfig } = useSiteConfig();
  const site = toSiteIdentity(siteConfig);

  const { t } = useI18n();

  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');

  const [chatLoading, setChatLoading] = useState(false);

  const [sessionId, setSessionId] = useState('');

  const [historyLoading, setHistoryLoading] = useState(true);

  const [thinkingAutoCollapse, setThinkingAutoCollapse] = useState(true);

  const [visitorId, setVisitorId] = useState('');

  const [aiLimits, setAiLimits] = useState<{ userLimit: number; guestLimit: number }>({ userLimit: DEFAULT_USER_RATE_LIMIT, guestLimit: DEFAULT_GUEST_DAILY_LIMIT });

  const [guestLocked, setGuestLocked] = useState(false);



  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [inputPlaceholder, setInputPlaceholder] = useState('');

  const [homeProducts, setHomeProducts] = useState<ContentItem[]>([]);

  const [productCategories, setProductCategories] = useState<ContentModuleCategory[]>([]);

  const [homeProductCounts, setHomeProductCounts] = useState<Record<string, number>>({});

  const [solutionCategories, setSolutionCategories] = useState<ContentModuleCategory[]>([]);

  const [resourceCategories, setResourceCategories] = useState<ContentModuleCategory[]>([]);

  const [homeCases, setHomeCases] = useState<ContentItem[]>([]);

  const [activeSection, setActiveSection] = useState('section-hero');

  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [coreModules, setCoreModules] = useState<CoreModule[]>([]);



  const [showForm, setShowForm] = useState(false);

  const [formMode, setFormMode] = useState<string>('demo');

  const [formData, setFormData] = useState({ name: '', company: '', phone: '', email: '', requirement: '' });

  const [formLoading, setFormLoading] = useState(false);

  const [formSuccess, setFormSuccess] = useState(false);

  const [formError, setFormError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollChatToBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isFirstRender = useRef(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachRef = useRef<HTMLDivElement>(null);

  const messagesRef = useRef<Message[]>(messages);

  const abortRef = useRef<AbortController | null>(null);

  const [uploading, setUploading] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<ChatFile[]>([]);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  useEffect(() => {

    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    const sid = getOrCreateSessionId();

    const vid = getVisitorId();

    setSessionId(sid);

    setVisitorId(vid);

    setMessages([]);

    // Restore recent conversation history for this session

    setHistoryLoading(true);

    aiService.sessions.history(sid).then((res: any) => {

      const msgs = Array.isArray(res?.messages) ? res.messages : (Array.isArray(res) ? res : []);

      if (msgs.length > 0 && messagesRef.current.length === 0) {

        const restored = mapHistoryToMessages(msgs);

        setMessages(trimMessages(restored));

      }

    }).catch(() => { /* treat as new session */ })

      .finally(() => setHistoryLoading(false));

      aiService.promptConfig.get().then((res: any) => {
        if (res.suggestions && res.suggestions.length > 0) {
          setSuggestions(res.suggestions);
        }
        if (res.welcome_message) setWelcomeMessage(res.welcome_message);
        if (res.input_placeholder) setInputPlaceholder(res.input_placeholder);
      }).catch(() => {});

    aiService.config.get().then((cfg: any) => {
      if (typeof cfg?.llm_thinking_auto_collapse === 'boolean') {
        setThinkingAutoCollapse(cfg.llm_thinking_auto_collapse);
      }
      const ul = typeof cfg?.ai_user_rate_limit === 'number' && cfg.ai_user_rate_limit > 0
        ? cfg.ai_user_rate_limit : DEFAULT_USER_RATE_LIMIT;
      const gl = typeof cfg?.ai_guest_daily_limit === 'number' && cfg.ai_guest_daily_limit > 0
        ? cfg.ai_guest_daily_limit : DEFAULT_GUEST_DAILY_LIMIT;
      setAiLimits({ userLimit: ul, guestLimit: gl });
    }).catch(() => {});

    api.get('/content/products/categories').then(r => {
      const cats: ContentModuleCategory[] = r.data || [];
      setProductCategories(cats);
    }).catch(() => {});

    api.get('/content/products', { params: { page: 1, size: 50 } }).then(r => {

      const records: ContentItem[] = r.data?.records || [];

      setHomeProducts(records);

      const lineMap: Record<string, number> = {};

      records.filter(p => p.groupName?.trim()).forEach(p => {

        lineMap[p.groupName!] = (lineMap[p.groupName!] || 0) + 1;

      });

      setHomeProductCounts(lineMap);

    }).catch(() => {});

    api.get('/content/cases', { params: { page: 1, size: 50 } }).then(r => {

      const all: ContentItem[] = r.data?.records || [];

      const shuffled = shuffleArray(all);

      setHomeCases(shuffled.slice(0, 6));

    }).catch(() => {});

    api.get('/content/solutions/categories').then(r => {
      const cats: ContentModuleCategory[] = r.data || [];
      setSolutionCategories(cats);
    }).catch(() => {});

    api.get('/content/resources/categories').then(r => {
      const cats: ContentModuleCategory[] = r.data || [];
      setResourceCategories(cats);
    }).catch(() => {});

    api.get('/home/sections').then(r => setHomeSections(r.data || [])).catch(() => {});

    api.get('/core-modules').then(r => {
      const list: CoreModule[] = r.data || [];
      setCoreModules(list.filter(m => m.status === 1));
    }).catch(() => {});

  }, []);

  // 游客本地配额与登录状态联动：登录后解锁，未登录且配额用尽则锁定
  useEffect(() => {
    if (user) {
      setGuestLocked(false);
    } else if (getGuestQuota() >= aiLimits.guestLimit) {
      setGuestLocked(true);
    }
  }, [user, aiLimits.guestLimit]);

  useEffect(() => {

    messagesRef.current = messages;

    if (isFirstRender.current) {

      isFirstRender.current = false;

      return;

    }

    const container = messagesContainerRef.current;

    if (container) {

      container.scrollTop = container.scrollHeight;

    }

  }, [messages]);

  useEffect(() => {

    if (messages.length > MAX_CONTEXT_MESSAGES) {

      setMessages(messages.slice(-MAX_CONTEXT_MESSAGES));

    }

  }, [messages]);

  useEffect(() => {

    const ids = ['hero', ...coreModules.map((m) => m.moduleKey), 'cta'];

    const observer = new IntersectionObserver((entries) => {

      for (const entry of entries) {

        if (entry.isIntersecting) {

          setActiveSection(entry.target.id);

        }

      }

    }, { rootMargin: '-40% 0px -55% 0px' });

    ids.forEach((id) => {

      const el = document.getElementById(`section-${id}`);

      if (el) observer.observe(el);

    });

    return () => observer.disconnect();

  }, [coreModules]);

  const startNewSession = () => {

    if (chatLoading || uploading) return;

    setMessages([]);

    const sid = createNewSessionId();

    setSessionId(sid);

  };

  const sendMessage = async (message?: string) => {

    const text = (message || input).trim();

    const files = pendingFiles;

    if (!text && files.length === 0) return;

    if (chatLoading) return;

    if (isSendBlocked(user, guestLocked, aiLimits, setGuestLocked, setMessages)) return;

    setInput('');

    setPendingFiles([]);

    const userInput = buildUserInput(text, files);

    if (files.length > 0) {

      setMessages(prev => [...prev, { role: 'user', content: text || '查看附件', files }]);

    } else {

      setMessages(prev => [...prev, { role: 'user', content: text }]);

    }

    setChatLoading(true);

    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;

    const markStopped = () => {

      setMessages(prev => {

        const updated = [...prev];

        const last = updated[updated.length - 1];

        if (last && last.role === 'assistant') {

          updated[updated.length - 1] = { ...last, stopped: true };

        } else {

          updated.push({ role: 'assistant', content: '', stopped: true } as any);

        }

        return updated;

      });

    };

    const ctx: ChatStreamContext = {
      user,
      aiLimits,
      setGuestLocked,
      setMessages,
      setFormMode,
      setFormData,
      setShowForm,
      submitLead,
      markStopped,
    };

    try {

      const chatBody = buildChatBody(user, userInput, sessionId, visitorId, text, files);

      const resp = await fetch(config.ai.baseUrl + '/chat', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(chatBody),

        signal: controller.signal,

      });

      const ct = resp.headers.get('content-type') || '';

      if (ct.includes('text/event-stream') && resp.body) {

        await processSseStream(resp.body, controller, ctx);

      } else {

        await handleJsonResponse(resp, ctx);

      }

    } catch (e) {

      console.error('[AI Chat] sendMessage error:', e);

      if ((e as any)?.name === 'AbortError' || controller.signal.aborted) {

        markStopped();

      } else {

        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我暂时无法回答。您可以点击"联系咨询"与顾问直接沟通。' }]);

      }

    } finally {

      setChatLoading(false);

      if (abortRef.current === controller) abortRef.current = null;

    }

  };

  const submitLead = async (mode: string, requirement?: string) => {

    if (!user) {

      setFormMode(mode as any);

      setFormData(prev => ({ ...prev, requirement: requirement || prev.requirement }));

      setShowForm(true);

      return;

    }

    const modeMap: Record<string, string> = { demo: 'demo-booking', solution: 'solution', case: 'case-consult', consult: 'consult' };

    const source = modeMap[mode] || 'consult';

    const labelMap: Record<string, string> = { demo: '产品演示预约', solution: '解决方案咨询', case: '案例咨询', consult: '商务咨询' };

    const label = labelMap[mode] || '咨询';

    try {

      const res: any = await api.post('/leads', {

        name: user.realName || user.username || '',

        company: '',

        phone: user.phone || '',

        email: user.email || '',

        requirement: requirement || `${label}（AI自动提交）`,

        source,

        sourcePage: '/',

      });

      if (res.code !== 200) {

        setMessages(prev => [...prev, {

          role: 'assistant',

          content: `${res.message || '提交失败'}，请稍后重试或直接联系客服。`,

        }]);

        return;

      }

      setMessages(prev => [...prev, {

        role: 'assistant',

        content: `已为您自动提交${label}申请，我们的顾问将在24小时内与您联系。您也可以继续咨询其他问题。`,

      }]);

    } catch {

      setMessages(prev => [...prev, {

        role: 'assistant',

        content: '提交失败，请稍后重试或直接联系客服。',

      }]);

    }

  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);

    try {

      const id = Date.now().toString(36) + secureRandomString(4);

      let fileType: 'image' | 'audio' | 'file' = 'file';

      if (file.type.startsWith('image/')) fileType = 'image';

      else if (file.type.startsWith('audio/')) fileType = 'audio';

      if (fileType === 'image') {

        const dataUrl = await new Promise<string>((resolve, reject) => {

          const reader = new FileReader();

          reader.onload = () => resolve(reader.result as string);

          reader.onerror = reject;

          reader.readAsDataURL(file);

        });

        setPendingFiles(prev => [...prev, { id, type: fileType, url: dataUrl, name: file.name }]);

      } else {

        // 解析文档内容（PDF/Word/txt 等）；失败时由后端兜底解析

        const parsed = await parseDocumentFile(file);

        setPendingFiles(prev => [...prev, { id, type: fileType, url: '', name: file.name, textContent: parsed.textContent, rawBase64: parsed.rawBase64, parseError: parsed.error }]);

      }

    } catch {

      // ignore read error

    } finally {

      setUploading(false);

    }

  };

  const removePendingFile = (id: string) => {

    setPendingFiles(prev => prev.filter(f => f.id !== id));

  };

  useEffect(() => {

    if (!attachMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);

  }, [attachMenuOpen]);

  const openForm = (mode: 'demo' | 'solution') => {

    if (!user) {

      setFormMode('login-prompt');

    } else {

      setFormMode(mode);

    setFormData({

      name: user.realName || user.username || '',

      company: '',

      phone: user.phone || '',

      email: user.email || '',

      requirement: '',

    });

      setFormSuccess(false);

      setFormError('');

    }

    setShowForm(true);

  };

  const renderProductsSection = (m: CoreModule, index: number) => (
    <section id={`section-${m.moduleKey}`} className={`py-12 ${sectionBg(index)}`}>
      <div className="max-w-[95rem] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
          <h2 className="section-title">{m.moduleTitle || m.moduleName}</h2>
          {m.moduleDescription && <p className="section-subtitle mx-auto">{m.moduleDescription}</p>}
        </motion.div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${moduleColClass(m)} gap-5`}>
          {(productCategories.length > 0 ? productCategories : []).slice(0, moduleRowLimit(m)).map((line, index) => (
            <motion.div key={line.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
              <Link href={categoryUrl('products', line.slug || '')} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group h-full">
                {line.coverImage && <img src={getImageUrl(line.coverImage)} alt={line.name} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />}
                <h3 className="text-lg font-semibold text-black mb-1 group-hover:text-gray-700 line-clamp-2">{line.name}</h3>
                <p className="text-base text-gray-500 leading-relaxed line-clamp-2">{line.description || `${homeProductCounts[line.name] || 0} 款产品`}</p>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8">
          <Link href={listUrl("products")} className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600 transition-colors">
            查看全部产品 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );

  const renderSolutionsSection = (m: CoreModule, index: number) => (
    <section id={`section-${m.moduleKey}`} className={`py-12 ${sectionBg(index)}`}>
      <div className="max-w-[95rem] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
          <h2 className="section-title">{m.moduleTitle || m.moduleName}</h2>
          {m.moduleDescription && <p className="section-subtitle mx-auto">{m.moduleDescription}</p>}
        </motion.div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${moduleColClass(m)} gap-5`}>
          {(solutionCategories.length > 0 ? solutionCategories : []).slice(0, moduleRowLimit(m)).map((ind, index) => (
            <motion.div key={ind.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
              <Link href={categoryUrl('solutions', ind.slug || '')} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group h-full">
                {ind.coverImage && <img src={getImageUrl(ind.coverImage)} alt={ind.name} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />}
                <h3 className="text-lg font-semibold text-black mb-1 group-hover:text-gray-700 line-clamp-2">{ind.name}</h3>
                <p className="text-base text-gray-500 leading-relaxed line-clamp-2">{ind.description || '查看方案'}</p>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8">
          <Link href={listUrl("solutions")} className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600 transition-colors">
            查看全部方案 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );

  const renderCasesSection = (m: CoreModule, index: number) => (
    <section id={`section-${m.moduleKey}`} className={`py-12 ${sectionBg(index)}`}>
      <div className="max-w-[95rem] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
          <h2 className="section-title">{m.moduleTitle || m.moduleName}</h2>
          {m.moduleDescription && <p className="section-subtitle mx-auto">{m.moduleDescription}</p>}
        </motion.div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${moduleColClass(m)} gap-5`}>
          {(homeCases.length > 0 ? homeCases : []).slice(0, moduleRowLimit(m)).map((c, index) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
              <Link href={detailUrl('cases', c.slug)} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group h-full">
                {c.coverImage && <img src={getImageUrl(c.coverImage)} alt={c.title} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />}
                <h3 className="text-lg font-semibold text-black mb-1 group-hover:text-gray-700 line-clamp-2">{c.title}</h3>
                <p className="text-base text-gray-500 leading-relaxed line-clamp-2">{c.summary}</p>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8">
          <Link href={listUrl("cases")} className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600 transition-colors">
            查看案例 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );

  const renderResourcesSection = (m: CoreModule, index: number) => (
    <section id={`section-${m.moduleKey}`} className={`py-12 ${sectionBg(index)}`}>
      <div className="max-w-[95rem] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
          <h2 className="section-title">{m.moduleTitle || m.moduleName}</h2>
          {m.moduleDescription && <p className="section-subtitle mx-auto">{m.moduleDescription}</p>}
        </motion.div>
        {(resourceCategories.length > 0) && (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${moduleColClass(m)} gap-5 mb-6`}>
            {resourceCategories.slice(0, moduleRowLimit(m)).map((cat, index) => (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
                <Link href={categoryUrl('resources', cat.slug || '')} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group h-full">
                  {cat.coverImage && <img src={getImageUrl(cat.coverImage)} alt={cat.name} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />}
                  <h3 className="text-lg font-semibold text-black mb-1 group-hover:text-gray-700 line-clamp-2">{cat.name}</h3>
                  <p className="text-base text-gray-500 leading-relaxed line-clamp-2">查看资源</p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8">
          <Link href={listUrl("resources")} className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600 transition-colors">
            查看全部资源 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );

  const renderGenericSection = (m: CoreModule, index: number) => (
    <GenericModuleSection module={m} index={index} />
  );

  const renderCoreModuleSection = (m: CoreModule, index: number) => {
    if (m.moduleKey === 'products') return renderProductsSection(m, index);
    if (m.moduleKey === 'solutions') return renderSolutionsSection(m, index);
    if (m.moduleKey === 'cases') return renderCasesSection(m, index);
    if (m.moduleKey === 'resources') return renderResourcesSection(m, index);
    return renderGenericSection(m, index);
  };

  const moduleDots = [
    { id: 'hero', label: 'AI对话' },
    ...coreModules.map((m) => ({ id: m.moduleKey, label: m.moduleTitle || m.moduleName })),
    { id: 'cta', label: '开启您的数字化之旅' },
  ];

  return (
    <>
      <SeoHead
        title={site.name || '首页'}
        description={site.description || ''}
        keywords=""
        path="/"
        additionalSchemas={site.name ? [
          generateSoftwareApplicationSchema({
            name: site.name,
            description: site.description || '',
            category: 'BusinessApplication',
          }, site),
        ] : []}
      />
      {/* ===== Screen 1: Hero + AI顾问 (OpenAI-style) ===== */}

      <section id="section-hero" className="relative min-h-screen flex flex-col overflow-hidden">

        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white" />

        <ParticleBackground />

        <div className="h-16 flex-shrink-0 relative z-10" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 max-w-[90rem] mx-auto w-full relative z-10">

          {!historyLoading && messages.length === 0 && (

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">

              <h1 className="text-3xl md:text-5xl font-semibold text-black mb-3 tracking-tight">

                {welcomeMessage || '有什么可以帮忙的？'}</h1>

            </motion.div>

          )}

          {/* Chat - Clean ChatGPT-like input */}

          <motion.div

            initial={{ opacity: 0, y: 10 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ delay: 0.15 }}

            className="w-full max-w-3xl"

          >

            <div className="relative">

              <div ref={messagesContainerRef} className="overflow-y-auto max-h-[50vh] space-y-3 mb-3 scrollbar-hide">

                {messages.map((message, index) => (

                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                    <div>

                      {message.files && message.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.files.map(f => (
                            <div key={f.id} className={`${f.type === 'image' ? '' : 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs'} ${
                              message.role === 'user' ? 'bg-white/10' : 'bg-gray-200/70'
                            }`}>
                              {f.type === 'image' ? (
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <>
                                  <FileText className={`w-4 h-4 ${message.role === 'user' ? 'text-white/70' : 'text-gray-500'}`} />
                                  <span className="truncate max-w-[120px]">{f.name}</span>
                                  {f.parseError && <span className="text-amber-500 text-[10px] flex-shrink-0" title={f.parseError}>解析失败</span>}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-gray-800 to-black text-white shadow-sm'
                          : 'bg-white/70 backdrop-blur-md border border-gray-200/50 text-black shadow-sm'
                      }`}>
                      {message.role === 'assistant' && message.reasoning && (
                        <details open={!thinkingAutoCollapse} className="mb-2">
                          <summary className="cursor-pointer select-none text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            <span>{t('home.ai.thinking')}</span>
                          </summary>
                          <div className="mt-2 text-xs text-gray-500 bg-gray-50/80 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                            {message.reasoning}
                          </div>
                        </details>
                      )}

                      {message.role === 'user' ? (
                        <div className="whitespace-nowrap">
                          {message.content.split('\n').map((line, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && <br />}
                              {line}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : (
                        <TypewriterMarkdown
                          content={message.content}
                          streaming={chatLoading && index === messages.length - 1 && message.role === 'assistant'}
                          onTick={scrollChatToBottom}
                        />
                      )}

                      {message.role === 'assistant' && message.stopped && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
                          <Square className="w-3 h-3" />
                          <span>{t('home.ai.stopped')}</span>
                        </div>
                      )}

                    </div>

                    </div>

                  </div>

                ))}

                {chatLoading && (

                  <div className="flex justify-start">

                    <div className="px-4 py-2.5 bg-white/70 backdrop-blur-md border border-gray-200/50 rounded-2xl">

                      <div className="flex gap-1.5">

                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />

                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />

                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />

                      </div>

                    </div>

                  </div>

                )}

                <div ref={messagesEndRef} />

              </div>

            </div>

            {/* Input Area - ChatGPT style */}

            <div className="border border-gray-200 rounded-2xl shadow-sm bg-white px-4 py-3 focus-within:border-gray-400 focus-within:shadow-md transition-all">

              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept=".txt,.md,.csv,.docx,.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg" />

              {pendingFiles.length > 0 && (

                <div className="flex flex-wrap gap-2 mb-2">

                  {pendingFiles.map(f => (

                    <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-700 max-w-[220px]">

                      <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

                      <span className="truncate">{f.name}</span>

                      {f.parseError && <span className="text-amber-600 truncate" title={f.parseError}>解析失败</span>}

                      <button onClick={() => removePendingFile(f.id)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0 ml-0.5"><X className="w-3 h-3" /></button>

                    </div>

                  ))}

                </div>

              )}

              <div className="flex items-center gap-2">

                <button

                  onClick={startNewSession}

                  disabled={chatLoading || uploading || guestLocked}

                  title="新会话"

                  className="p-1.5 text-gray-400 hover:text-black transition-colors disabled:opacity-50 flex-shrink-0"

                >

                  <SquarePen className="w-5 h-5" />

                </button>

                <textarea

                  value={input}

                  onChange={e => setInput(e.target.value)}

                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}

                  placeholder={guestLocked ? '今日免费次数已用完，请登录后继续使用' : (inputPlaceholder || t('home.ai.placeholder'))}

                  rows={1}

                  className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-gray-400 resize-none"

                  disabled={chatLoading || uploading || guestLocked}

                />

                <div ref={attachRef} className="relative flex-shrink-0">

                  <button

                    onClick={() => setAttachMenuOpen(v => !v)}

                    disabled={chatLoading || uploading || guestLocked}

                    title={t('home.ai.uploadFile')}

                    className="p-1.5 text-gray-400 hover:text-black transition-colors disabled:opacity-50 flex-shrink-0 relative"

                  >

                    <Paperclip className="w-5 h-5" />

                  </button>

                  {attachMenuOpen && !chatLoading && !uploading && !guestLocked && (

                    <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-20">

                      <button

                        onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}

                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"

                      >

                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />

                        {t('home.ai.uploadFile')}

                      </button>

                    </div>

                  )}

                </div>

                {chatLoading && !uploading ? (

                  <button

                    onClick={() => abortRef.current?.abort()}

                    title="停止生成"

                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0 text-xs font-medium"

                  >

                    <Square className="w-3.5 h-3.5" /> {t('home.ai.stop')}

                  </button>

                ) : (

                  <button

                    onClick={() => sendMessage()}

                    disabled={uploading || guestLocked || (input.trim() === '' && pendingFiles.length === 0)}

                    className="p-1.5 text-gray-400 hover:text-black transition-colors disabled:opacity-50 flex-shrink-0"

                  >

                    <Send className="w-5 h-5" />

                  </button>

                )}

              </div>

              {uploading && <div className="text-xs text-gray-400 mt-1.5">{t('home.ai.uploading')}</div>}

              {guestLocked && !user && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                    <span>您今日的 {aiLimits.guestLimit} 次免费咨询已用完，登录后即可继续使用AI顾问。</span>
                  </div>
                  <Link
                    href="/login"
                    className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    去登录
                  </Link>
                </div>
              )}

            </div>

            {/* Suggestion pills below input, hidden after user sends first message */}

            {suggestions.length > 0 && messages.length === 0 && (

              <div className="flex flex-wrap gap-2 justify-center mt-3">

                {suggestions.map((q) => (

                  <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-xs hover:bg-gray-200 transition-colors whitespace-nowrap">{q}</button>

                ))}

              </div>

            )}

          </motion.div>

        </div>

      </section>

      {/* ===== 核心模块区块（由后台核心模块配置动态渲染，支持排序与启停）===== */}

      {coreModules.map((m, index) => (
        <React.Fragment key={m.id}>
          {renderCoreModuleSection(m, index)}
        </React.Fragment>
      ))}

      {/* ===== Blocks from Admin ===== */}
      {homeSections.map((s, i) => (
        <BlockRenderer key={s.id} section={s} index={i} />
      ))}

      {/* ===== Screen 8: CTA ===== */}

      <section id="section-cta" className="py-16 bg-gradient-to-b from-gray-50 to-white text-black">

        <div className="max-w-4xl mx-auto px-6 text-center">

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>

            <h2 className="section-title mb-4">开启您的数字化之旅</h2>

            <p className="text-gray-500 mb-8 max-w-xl mx-auto text-lg">

              让我们为您设计一套可落地的数字化升级方案

            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">

              <button onClick={() => openForm('solution')} className="btn-primary">获取解决方案 <ArrowRight className="w-4 h-4" /></button>

              <Link href={listUrl('resources')} className="btn-outline">浏览资源</Link>

              <button onClick={() => openForm('demo')} className="btn-outline">预约产品演示</button>

            </div>

          </motion.div>

        </div>

      </section>

      <Footer />

      {/* Form / Auth Modal */}

      {showForm && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-center mb-5">

              <h3 className="text-lg font-semibold">{formTitles[formMode] || '获取解决方案'}</h3>

              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>

            </div>

            {formMode === 'login-prompt' ? (

              <div className="text-center py-6">

                <p className="text-gray-700 mb-6">请先注册或登录后，再提交需求</p>

                <div className="flex gap-3 justify-center">

                  <button onClick={() => router.push('/login')} className="px-5 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">去登录</button>

                  <button onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">稍后再说</button>

                </div>

              </div>

            ) : formSuccess ? (

              <div className="text-center py-8">

                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />

                <p className="text-gray-700 font-medium mb-1">提交成功！</p>

                <p className="text-sm text-gray-500">我们的顾问将尽快与您联系。</p>

                <button onClick={() => { setShowForm(false); setFormSuccess(false); }} className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm">知道了</button>

              </div>

            ) : (

              <form onSubmit={async e => {

                e.preventDefault();

                const phoneErr = !isValidPhone(formData.phone) ? '请输入正确的手机号' : '';

                const emailErr = formMode !== 'solution' && formData.email && !isValidEmail(formData.email) ? '请输入正确的邮箱地址' : '';

                if (phoneErr || emailErr) return;

                setFormLoading(true);

                setFormError('');

                try {

                  const source = formMode === 'demo' ? 'demo-booking' : 'solution';

                  const res: any = await api.post('/leads', { ...formData, source, sourcePage: '/' });

                  if (res.code !== 200) {

                    if (res.code === 400 && res.message === 'duplicate_submission') {

                      setFormError('已提交过申请，请耐心等待管理人员联系');

                    } else {

                      setFormError(res.message || '提交失败，请稍后再试');

                    }

                    return;

                  }

                  setFormSuccess(true);

                  setFormData({ name: '', company: '', phone: '', email: '', requirement: '' });

                } catch {

                  setFormError('提交失败，请稍后再试');

                }

                finally { setFormLoading(false); }

              }} className="space-y-3">

                <div>

                  <label className="block text-xs text-gray-500 mb-1">姓名 <span className="text-red-400">*</span></label>

                  <input required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="您的姓名" />

                </div>

                <div>

                  <label className="block text-xs text-gray-500 mb-1">手机号 <span className="text-red-400">*</span></label>

                  <input required value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="请输入11位手机号" />

                  {formData.phone && !isValidPhone(formData.phone) && <p className="text-xs text-red-500 mt-1">请输入正确的11位手机号</p>}

                </div>

                {formMode !== 'solution' && (<><div>

                  <label className="block text-xs text-gray-500 mb-1">企业名称</label>

                  <input value={formData.company} onChange={e => setFormData(p => ({ ...p, company: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="企业名称" />

                </div>

                <div>

                  <label className="block text-xs text-gray-500 mb-1">邮箱</label>

                  <input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="您的邮箱" />

                </div>

                <div>

                  <label className="block text-xs text-gray-500 mb-1">产品/方案需求</label>

                  <textarea value={formData.requirement} onChange={e => setFormData(p => ({ ...p, requirement: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" rows={3} placeholder="您想了解的产品或方案" />

                </div></>)}

                <button type="submit" disabled={formLoading} className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">

                  {formLoading ? '提交中...' : formSubmitText[formMode] || '立即获取'}

                </button>

                {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}

              </form>

            )}

          </div>

        </div>

      )}

      {/* Dot Navigation */}

      <style>{`@keyframes df{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.7;transform:scale(1.2)}}`}</style>

      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3">

        {moduleDots.map((dot) => {

          const isActive = activeSection === `section-${dot.id}`;

          return (

            <button

              key={dot.id}

              onClick={() => document.getElementById(`section-${dot.id}`)?.scrollIntoView({ behavior: 'smooth' })}

              className="group relative flex items-center justify-center"

              title={dot.label}

            >

              <span className={`rounded-full transition-all duration-500 ${isActive ? 'w-3 h-3 bg-black scale-110' : 'w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400'}`} style={isActive ? {} : { animation: `df 2.4s ease-in-out infinite`, animationDelay: `${moduleDots.indexOf(dot) * 0.3}s` }} />

              <span className="absolute right-5 px-2 py-0.5 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">

                {dot.label}

              </span>

            </button>

          );

        })}

      </div>

    </>

  );

}

function GenericModuleSection({ module, index }: { module: CoreModule; index: number }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.get(`/content/${module.moduleKey}`, { params: { page: 1, size: 6 } })
      .then((res: any) => setItems(res.data?.records || []))
      .catch(() => setItems([]));
  }, [module.moduleKey]);

  return (
    <section id={`section-${module.moduleKey}`} className={`py-12 ${sectionBg(index)}`}>
      <div className="max-w-[95rem] mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
          <h2 className="section-title">{module.moduleTitle || module.moduleName}</h2>
          {module.moduleDescription && <p className="section-subtitle mx-auto">{module.moduleDescription}</p>}
        </motion.div>
        {items.length > 0 && (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${moduleColClass(module)} gap-5 text-left`}>
            {items.slice(0, moduleRowLimit(module)).map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <a href={detailUrl(module.moduleKey, item.slug)} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group h-full">
                  {item.coverImage && <img src={getImageUrl(item.coverImage)} alt={item.title} className="w-full aspect-[4/3] object-cover rounded-lg mb-3" />}
                  {module.moduleType !== 2 && item.groupName && <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full mb-2">{item.groupName}</span>}
                  <h3 className="text-lg font-semibold text-black mb-1 line-clamp-2">{item.title}</h3>
                  <p className="text-base text-gray-500 leading-relaxed line-clamp-2">{item.summary}</p>
                </a>
              </motion.div>
            ))}
          </div>
        )}
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8">
          <a href={moduleHref(module)} className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:text-gray-600 transition-colors">
            进入{module.moduleName} <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
