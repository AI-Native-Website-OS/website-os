import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_CONTEXT_MESSAGES,
  generateSessionId,
  getOrCreateSessionId,
  createNewSessionId,
  trimMessages,
  mapHistoryToMessages,
} from './chatHistory';

describe('session id helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a prefixed session id', () => {
    expect(generateSessionId()).toMatch(/^session_/);
  });

  it('creates and persists a session id on first call', () => {
    const sid = getOrCreateSessionId();
    expect(sid).toMatch(/^session_/);
    expect(localStorage.getItem('sn_chat_session_id')).toBe(sid);
  });

  it('reuses the persisted session id', () => {
    localStorage.setItem('sn_chat_session_id', 'session_abc');
    expect(getOrCreateSessionId()).toBe('session_abc');
  });

  it('createNewSessionId replaces the persisted session id', () => {
    localStorage.setItem('sn_chat_session_id', 'session_old');
    const sid = createNewSessionId();
    expect(sid).not.toBe('session_old');
    expect(localStorage.getItem('sn_chat_session_id')).toBe(sid);
  });
});

describe('trimMessages', () => {
  it('keeps messages when under the limit', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => i);
    expect(trimMessages(msgs)).toHaveLength(10);
  });

  it('keeps only the latest MAX_CONTEXT_MESSAGES messages', () => {
    const msgs = Array.from({ length: 30 }, (_, i) => i);
    const trimmed = trimMessages(msgs);
    expect(trimmed).toHaveLength(MAX_CONTEXT_MESSAGES);
    expect(trimmed[0]).toBe(10);
    expect(trimmed[trimmed.length - 1]).toBe(29);
  });
});

describe('mapHistoryToMessages', () => {
  it('maps roles and string content', () => {
    const result = mapHistoryToMessages([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '您好' },
    ]);
    expect(result).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '您好' },
    ]);
  });

  it('stringifies non-string content', () => {
    const result = mapHistoryToMessages([{ role: 'assistant', content: { text: 'hi' } }]);
    expect(result[0].content).toBe(JSON.stringify({ text: 'hi' }));
  });

  it('maps unknown roles to assistant', () => {
    const result = mapHistoryToMessages([{ role: 'system', content: 'x' }]);
    expect(result[0].role).toBe('assistant');
  });

  it('carries assistant reasoning through when present', () => {
    const result = mapHistoryToMessages([
      { role: 'assistant', content: '回答', reasoning: '思考过程' },
    ]);
    expect(result[0]).toEqual({ role: 'assistant', content: '回答', reasoning: '思考过程' });
  });

  it('omits reasoning when absent', () => {
    const result = mapHistoryToMessages([{ role: 'assistant', content: '回答' }]);
    expect(result[0]).toEqual({ role: 'assistant', content: '回答' });
    expect(result[0].reasoning).toBeUndefined();
  });
});
