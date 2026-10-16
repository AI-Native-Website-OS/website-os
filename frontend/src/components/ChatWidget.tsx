'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, ChevronRight, X, FileText, Paperclip, ImageIcon, Brain } from 'lucide-react';
import aiApi from '@/lib/aiApi';
import { aiService } from '@/lib/aiService';
import api from '@/lib/api';
import config from '@/config';
import { generateVisitorId, secureRandomString } from '@/lib/utils';
import { parseDocumentFile } from '@/lib/fileParser';
import { useAuth } from '@/hooks/useAuth';
import Markdown from '@/components/Markdown';
import { useI18n } from '@/i18n/I18nProvider';
import { t as translate } from '@/i18n/translate';
import { DEFAULT_TEXT_STYLE, normalizeTextStyle, textStyleToCss, inputTextStyleToCss } from '@/lib/textStyle';
import { friendlyChatError } from '@/lib/chatError';
import type { TextStyle, ContentRecommendation } from '@/types';
import RecommendationChips from '@/components/RecommendationChips';

interface PendingFile {
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
  timestamp?: Date;
  files?: PendingFile[];
  recommendations?: {
    items?: ContentRecommendation[];
    action?: 'showForm';
    actionData?: { mode?: string; requirement?: string };
  };
}

interface LeadForm {
  name: string;
  company: string;
  phone: string;
  email: string;
  requirement: string;
}

interface ChatStreamContext {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLeadForm: React.Dispatch<React.SetStateAction<LeadForm>>;
  setShowLeadForm: (v: boolean) => void;
}

function buildUserInput(text: string, files: PendingFile[]): string {
  const textFiles = files.filter(f => f.type === 'file' && f.textContent);
  if (textFiles.length === 0) return text;
  const parts = textFiles.map(f => `以下是我上传的文件${f.name}的内容：\n\`\`\`\n${f.textContent}\n\`\`\``);
  return parts.join('\n\n') + `\n\n${text || '请分析这个文件'}`;
}

function buildChatBody(user: any, userInput: string, sessionId: string, text: string, files: PendingFile[]): Record<string, any> {
  const body: Record<string, any> = { user_input: userInput, session_id: sessionId, username: user?.realName || user?.username || '', role: user?.role || '', original_input: text || (files.length > 0 ? translate('publicComp.viewAttachment') : '') };
  if (files.length > 0) {
    const imgUrls = files.filter(f => f.type === 'image').map(f => f.url);
    if (imgUrls.length > 0) body.images = imgUrls;
    body.attachments = files.filter(f => f.type !== 'image').map(f => ({ type: 'file' as const, name: f.name, ...(f.rawBase64 ? { base64: f.rawBase64 } : {}) }));
  }
  return body;
}

function pushAssistant(prev: Message[], content: string): Message[] {
  return [...prev, { role: 'assistant', content, timestamp: new Date() }];
}

function appendReasoning(prev: Message[], content: string): Message[] {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, reasoning: (last.reasoning || '') + content };
  } else {
    updated.push({ role: 'assistant', content: '', reasoning: content, timestamp: new Date() });
  }
  return updated;
}

function appendContent(prev: Message[], content: string): Message[] {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    last.content += content;
  } else {
    updated.push({ role: 'assistant', content, timestamp: new Date() });
  }
  return updated;
}

function finalizeAssistant(prev: Message[], parsed: any): Message[] {
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    updated[updated.length - 1] = { ...last, content: parsed.content || last.content, reasoning: parsed.reasoning || last.reasoning, recommendations: parsed.recommendations };
  } else {
    updated.push({ role: 'assistant', content: parsed.content || '', reasoning: parsed.reasoning, recommendations: parsed.recommendations, timestamp: new Date() });
  }
  return updated;
}

function handleChatEvent(parsed: any, ctx: ChatStreamContext): boolean {
  if (parsed.type === 'error') {
    ctx.setMessages(prev => pushAssistant(prev, friendlyChatError(parsed.code)));
    return true;
  }
  if (parsed.type === 'reasoning' && parsed.content) {
    ctx.setMessages(prev => appendReasoning(prev, parsed.content));
    return false;
  }
  if (parsed.type === 'content' && parsed.content) {
    ctx.setMessages(prev => appendContent(prev, parsed.content));
    return false;
  }
  if (parsed.type === 'done') {
    ctx.setMessages(prev => finalizeAssistant(prev, parsed));
    if (parsed.recommendations?.action === 'showForm') {
      const req = parsed.recommendations?.actionData?.requirement;
      if (req) {
        ctx.setLeadForm(prev => ({ ...prev, requirement: req }));
      }
      ctx.setShowLeadForm(true);
    }
    return false;
  }
  return false;
}

async function consumeChatStream(body: ReadableStream<Uint8Array>, ctx: ChatStreamContext): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(line.substring(6));
      } catch {
        continue;
      }
      if (handleChatEvent(parsed, ctx)) break;
    }
  }
}

async function streamChat(body: Record<string, any>, ctx: ChatStreamContext): Promise<void> {
  const controller = new AbortController();
  const response = await fetch(config.ai.baseUrl + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!response.ok) throw new Error('Request failed');
  if (!response.body) throw new Error('Stream not available');
  await consumeChatStream(response.body, ctx);
}

async function retryChatRequest(user: any, userInput: string, sessionId: string, text: string, files: PendingFile[], ctx: ChatStreamContext): Promise<void> {
  const body = buildChatBody(user, userInput, sessionId, text, files);
  const resp = await (await fetch(config.ai.baseUrl + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).json();
  ctx.setMessages(prev => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last && last.role === 'assistant') {
      updated[updated.length - 1] = { ...last, content: resp.content || resp.message || last.content, reasoning: resp.reasoning || last.reasoning, recommendations: resp.recommendations };
    } else {
      updated.push({ role: 'assistant', content: resp.content || resp.message || translate('publicComp.fallbackAdvisorSoon'), reasoning: resp.reasoning, recommendations: resp.recommendations, timestamp: new Date() });
    }
    return updated;
  });
  if (resp.recommendations?.action === 'showForm') {
    ctx.setShowLeadForm(true);
  }
}

function pushAssistantFallback(prev: Message[]): Message[] {
  const content = friendlyChatError('connection');
  const updated = [...prev];
  const last = updated[updated.length - 1];
  if (last && last.role === 'assistant') {
    last.content = content;
  } else {
    updated.push({ role: 'assistant', content, timestamp: new Date() });
  }
  return updated;
}

export default function ChatWidget() {
  const { t } = useI18n();
  const { user } = useAuth();
  const leadFormLocked = !!user;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadForm>({
    name: '',
    company: '',
    phone: '',
    email: '',
    requirement: '',
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setLeadForm(prev => ({
        ...prev,
        name: user.realName || user.username || '',
        company: user.companyName || '',
        phone: user.phone || '',
        email: user.email || '',
      }));
    }
  }, [user]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [inputPlaceholder, setInputPlaceholder] = useState('');
  const [welcomeStyle, setWelcomeStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [inputStyle, setInputStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sid = 'session_' + Date.now() + '_' + secureRandomString(9);
    const vid = generateVisitorId();
    setSessionId(sid);
    setVisitorId(vid);
    
    const fallback = translate('publicComp.greeting');
    setMessages([{ role: 'assistant', content: fallback, timestamp: new Date() }]);

    aiService.config.get().then((cfg: any) => {
      if (typeof cfg?.llm_thinking_enabled === 'boolean') {
        setThinkingEnabled(cfg.llm_thinking_enabled);
      }
      const sp = cfg.system_prompt || '';
      const lines = sp.split('\n');
      const greeting = lines.find((l: string) => l.startsWith('//greeting:') || l.startsWith('#greeting:'));
      if (greeting) {
        const msg = greeting.replace(/^\/\/greeting:|^#greeting:/, '').trim();
        setMessages([{ role: 'assistant', content: msg, timestamp: new Date() }]);
      }
    }).catch(() => {});
    aiService.promptConfig.get().then((res: any) => {
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
      if (res.welcome_message) {
        setMessages([{ role: 'assistant', content: res.welcome_message, timestamp: new Date() }]);
      }
      if (res.input_placeholder) setInputPlaceholder(res.input_placeholder);
      setWelcomeStyle(normalizeTextStyle(res.welcome_message_style));
      setInputStyle(normalizeTextStyle(res.input_placeholder_style));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (message?: string) => {
    const text = (message || input).trim();
    const files = pendingFiles;
    if ((!text && files.length === 0) || loading) return;

    setInput('');
    setPendingFiles([]);

    const userInput = buildUserInput(text, files);

    if (files.length > 0) {
      setMessages((prev) => [...prev, { role: 'user', content: text || t('publicComp.viewAttachment'), files, timestamp: new Date() }]);
    } else {
      setMessages((prev) => [...prev, { role: 'user', content: text || '', timestamp: new Date() }]);
    }
    setLoading(true);

    const ctx: ChatStreamContext = { setMessages, setLeadForm, setShowLeadForm };

    try {
      await streamChat(buildChatBody(user, userInput, sessionId, text, files), ctx);
    } catch (e) {
      console.error('[ChatWidget] sendMessage error:', e);
      try {
        await retryChatRequest(user, userInput, sessionId, text, files, ctx);
      } catch (e2) {
        console.error('[ChatWidget] retry also failed:', e2);
        ctx.setMessages(prev => pushAssistantFallback(prev));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/leads', {
        ...leadForm,
        source: 'ai_chat',
        sourcePage: window.location.pathname,
        sessionId,
        visitorId,
      });
      setLeadSubmitted(true);
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: t('publicComp.leadThanks'),
        timestamp: new Date() 
      }]);
    } catch (error) {
      console.error('Failed to submit lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const aiResponseCount = messages.filter(m => m.role === 'assistant' && m.content.length > 0).length;

  // Auto-trigger lead form after 2+ meaningful exchanges
  useEffect(() => {
    if (userMessageCount >= 2 && aiResponseCount >= 2 && !showLeadForm && !leadSubmitted && !localStorage.getItem('sn_chat_lead_triggered')) {
      const firstQuestion = messages.find(m => m.role === 'user')?.content || '';
      setLeadForm(prev => ({
        ...prev,
        requirement: firstQuestion ? `AI咨询：${firstQuestion.substring(0, 100)}` : prev.requirement,
      }));
      const timer = setTimeout(() => {
        localStorage.setItem('sn_chat_lead_triggered', '1');
        setShowLeadForm(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userMessageCount, aiResponseCount, showLeadForm, leadSubmitted, messages]);

  const handleGenerateSolution = () => {
    setShowLeadForm(true);
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

  return (
    <div id="chat" className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-full mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">{t('publicComp.chatBadge')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-black mb-3">{t('publicComp.chatTitle')}</h2>
          <p className="text-gray-500">{t('publicComp.chatSubtitle')}</p>
        </motion.div>

        {/* Chat Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm"
        >
          {/* Messages */}
          <div ref={messagesContainerRef} className="h-[400px] overflow-y-auto p-6 space-y-4 scrollbar-hide">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-black'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
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
                                  {f.parseError && <span className="text-amber-500 text-[10px] flex-shrink-0" title={f.parseError}>{t('publicComp.parseFailed')}</span>}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        style={index === 0 && message.role === 'assistant' ? textStyleToCss(welcomeStyle) : undefined}
                        className={`px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-black'
                        }`}
                      >
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
                          <>
                            {thinkingEnabled && message.reasoning && (
                              <details className="mb-2">
                                <summary className="cursor-pointer select-none text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                                  <Brain className="w-3 h-3" />
                                  <span>{t('publicComp.thinkingProcess')}</span>
                                </summary>
                                <div className="mt-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                                  {message.reasoning}
                                </div>
                              </details>
                            )}
                            <Markdown content={message.content} />
                          </>
                        )}
                      </div>
                      {message.role === 'assistant' && (
                        <RecommendationChips items={message.recommendations?.items} />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-black flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-3 bg-gray-100 rounded-2xl">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick Questions */}
          {suggestions.length > 0 && messages.length <= 1 && (
            <div className="px-6 pb-4">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => sendMessage(question)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generate Solution Button */}
          {messages.length > 2 && !showLeadForm && (
            <div className="px-6 pb-4">
              <button
                onClick={handleGenerateSolution}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <FileText className="w-4 h-4" />
                {t('publicComp.generateSolution')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {suggestions.length > 0 && messages.length > 1 && (
            <div className="px-6 pb-2 pt-1 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200 transition-colors whitespace-nowrap">{q}</button>
                ))}
              </div>
            </div>
          )}
          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            {/* File preview chips */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pendingFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs">
                    {f.type === 'image' ? (
                      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    {f.parseError && <span className="text-amber-600 text-[10px] truncate max-w-[80px]" title={f.parseError}>{t('publicComp.parseFailed')}</span>}
                    <button onClick={() => removePendingFile(f.id)} className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,.md,.csv,.docx,.pdf,.jpg,.jpeg,.png,.gif,.webp"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
                className="p-3 text-gray-400 hover:text-black transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={uploading ? t('publicComp.readingFile') : (inputPlaceholder || t('publicComp.inputPlaceholder'))}
                rows={1}
                style={inputTextStyleToCss(inputStyle)}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none placeholder:text-[color:var(--ph-color)]"
                disabled={loading || uploading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || (!input.trim() && pendingFiles.length === 0)}
                className="px-5 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Lead Form Modal */}
        {showLeadForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full"
            >
              {leadSubmitted ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-2">{t('publicComp.submitSuccess')}</h3>
                  <p className="text-gray-500 mb-6">{t('publicComp.contactWithin24h')}</p>
                  <button
                    onClick={() => {
                      setShowLeadForm(false);
                      setLeadSubmitted(false);
                    }}
                    className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
                  >
                    {t('publicComp.close')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-black">{t('publicComp.getCustomSolution')}</h3>
                    <button
                      onClick={() => setShowLeadForm(false)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  {leadFormLocked && (
                    <p className="text-xs text-gray-400 mb-4 -mt-2">{t('publicComp.loggedInLockNote')}</p>
                  )}
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.name')} *</label>
                      <input
                        type="text"
                        required
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                        disabled={leadFormLocked}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.company')}</label>
                      <input
                        type="text"
                        value={leadForm.company}
                        onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                        disabled={leadFormLocked}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.phone')} *</label>
                      <input
                        type="tel"
                        required
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        disabled={leadFormLocked}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.email')}</label>
                      <input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        disabled={leadFormLocked}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.requirement')}</label>
                      <textarea
                        rows={3}
                        value={leadForm.requirement}
                        onChange={(e) => setLeadForm({ ...leadForm, requirement: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                        placeholder={t('publicComp.requirementPlaceholder')}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? t('publicComp.submitting') : t('publicComp.submitRequirement')}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
