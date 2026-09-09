'use client';

import { useEffect, useState } from 'react';
import { aiService } from '@/lib/aiService';
import { Bot, User, Clock, Brain, FileText } from 'lucide-react';
import { mapHistoryToMessages } from '@/lib/chatHistory';
import type { RestoredMessage } from '@/lib/chatHistory';
import type { SessionOut } from '@/types';
import Markdown from '@/components/Markdown';
import { useI18n } from '@/i18n/I18nProvider';

export default function AdminAiChats() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RestoredMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res: any = await aiService.sessions.list();
      setSessions(Array.isArray(res) ? res : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadMessages = async (sessionId: string) => {
    setMsgLoading(true);
    setSelectedSessionId(sessionId);
    try {
      const res: any = await aiService.sessions.history(sessionId);
      const msgs = res.messages || res || [];
      setMessages(mapHistoryToMessages(Array.isArray(msgs) ? msgs : []));
    } catch (err) { console.error(err); }
    finally { setMsgLoading(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.chatRecords')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">{t('admin.ui.chats.listTitle').replace('{n}', String(sessions.length))}</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{t('admin.ui.chats.noSessions')}</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {sessions.map(session => (
                <button key={session.session_id} onClick={() => loadMessages(session.session_id)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedSessionId === session.session_id ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{session.title || session.session_id}</span>
                      <span className="text-xs text-gray-400">{session.created_at ? new Date(session.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {session.username && <span className="truncate max-w-[100px]">{session.username}</span>}
                      <span>{t('admin.ui.chats.messagesCount').replace('{n}', String(session.message_count))}</span>
                      <Clock className="w-3 h-3" />
                      <span>{session.last_active ? new Date(session.last_active).toLocaleTimeString() : ''}</span>
                    </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">{t('admin.ui.chats.msgDetailTitle')}</h3>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
            {!selectedSessionId && <p className="text-center text-gray-400 py-8">{t('admin.ui.chats.selectSessionHint')}</p>}
            {msgLoading && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div></div>}
            {selectedSessionId && !msgLoading && messages.length === 0 && <p className="text-center text-gray-400 py-8">{t('admin.ui.chats.noMessages')}</p>}
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-xs max-w-full ${msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.files.map(f => (
                          <div key={f.id} className={`${f.type === 'image' ? '' : 'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px]'} ${
                            msg.role === 'user' ? 'bg-white/10' : 'bg-white border border-gray-200'
                          }`}>
                            {f.type === 'image' ? (
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <>
                                <FileText className={`w-3.5 h-3.5 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`} />
                                <span className="truncate max-w-[140px]">{f.name}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.reasoning && (
                      <details className="mb-2">
                        <summary className="cursor-pointer select-none flex items-center gap-1 text-gray-500 hover:text-gray-700">
                          <Brain className="w-3 h-3" />
                          <span>{t('home.ai.thinking')}</span>
                        </summary>
                        <div className="mt-2 text-[11px] text-gray-500 bg-white border border-gray-200 rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed">
                          {msg.reasoning}
                        </div>
                      </details>
                    )}
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="break-words">
                        <Markdown content={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
