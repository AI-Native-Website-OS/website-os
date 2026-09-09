'use client';

import { useEffect, useState, useCallback } from 'react';
import { aiService } from '@/lib/aiService';
import type { MemoryFileInfo } from '@/types';
import { Database, FileText, Save, Loader2, Folder, File, ChevronDown, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useI18n } from '@/i18n/I18nProvider';

interface FileEntry {
  username: string;
  filename: string;
  line_count: number;
  updated_at: string;
}

export default function AdminAiMemory() {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ username: string; filename: string } | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await aiService.memory.listFiles();
      setFiles(res.files || []);
    } catch { setFiles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const users = [...new Set(files.map(f => f.username))].sort();

  const toggleUser = (username: string) => {
    setExpanded(prev =>
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    );
  };

  const userFiles = (username: string) => files.filter(f => f.username === username);

  const selectFile = async (username: string, filename: string) => {
    setSelected({ username, filename });
    setError('');
    setPreview(true);
    try {
      const res: any = await aiService.memory.getFile(username, filename);
      setContent(res.content || '');
    } catch {
      setError(t('common.loadFail'));
      setContent('');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await aiService.memory.saveFile(selected.username, { content }, selected.filename);
      await loadFiles();
    } catch { setError(t('common.saveFail')); }
    finally { setSaving(false); }
  };

  const isSelected = (username: string, filename: string) =>
    selected?.username === username && selected?.filename === filename;

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-6">
      <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-4 h-4" />
            {t('admin.ui.memory.title')}
          </h2>
          <span className="text-xs text-gray-400">{t('admin.ui.memory.count').replace('{n}', String(files.length))}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t('admin.ui.memory.noFiles')}</div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <Folder className="w-3.5 h-3.5" />
                memories/
              </div>
              <div className="ml-3 border-l border-gray-200 space-y-0.5">
                {users.map(username => {
                  const open = expanded.includes(username);
                  const ufs = userFiles(username);
                  return (
                    <div key={username}>
                      <button
                        onClick={() => toggleUser(username)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-black transition-colors text-left"
                      >
                        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
                        <Folder className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                        <span className="font-medium">{username}</span>
                        <span className="text-xs text-gray-300 ml-auto">{ufs.length}</span>
                      </button>
                      {open && (
                        <div className="ml-5 space-y-0.5">
                          {ufs.map(f => (
                            <button
                              key={f.filename}
                              onClick={() => selectFile(username, f.filename)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                                isSelected(username, f.filename)
                                  ? 'bg-black text-white'
                                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                              }`}
                            >
                              <File className={`w-3 h-3 flex-shrink-0 ${
                                isSelected(username, f.filename) ? 'text-white/60' : 'text-gray-300'
                              }`} />
                              <span className="truncate">{f.filename}</span>
                              <span className={`text-xs ml-auto ${
                                isSelected(username, f.filename) ? 'text-white/40' : 'text-gray-300'
                              }`}>{t('admin.ui.memory.lines').replace('{n}', String(f.line_count))}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">memories/{selected.username}/{selected.filename}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(!preview)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  {preview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{preview ? t('common.edit') : t('admin.ui.memory.preview')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
            {error && (
              <div className="mx-5 mt-3 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
            )}
            {preview ? (
              <div className="flex-1 overflow-y-auto p-8 max-w-none text-gray-800 leading-7 text-base
                [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:border-b [&_h1]:border-gray-200 [&_h1]:pb-3 [&_h1]:mb-6 [&_h1]:mt-0
                [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:border-b [&_h2]:border-gray-100 [&_h2]:pb-2 [&_h2]:mb-4 [&_h2]:mt-8
                [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6
                [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-4
                [&_p]:my-4 [&_p]:leading-7
                [&_a]:text-blue-600 [&_a]:no-underline [&_a]:cursor-pointer hover:[&_a]:underline
                [&_strong]:text-gray-900 [&_strong]:font-semibold
                [&_code]:bg-gray-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-pink-600 [&_code]:border [&_code]:border-gray-200 [&_code]:font-mono
                [&_pre]:bg-gray-50 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-4 [&_pre]:overflow-x-auto
                [&_pre_code]:bg-transparent [&_pre_code]:border-none [&_pre_code]:p-0 [&_pre_code]:text-gray-800 [&_pre_code]:text-sm
                [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:my-4 [&_blockquote]:py-1
                [&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc
                [&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal
                [&_li]:my-1.5
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:border [&_th]:border-gray-200
                [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-sm [&_td]:border [&_td]:border-gray-200
                [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full
                [&_hr]:my-8 [&_hr]:border-gray-200
                [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:rounded
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="flex-1 p-5 text-sm font-mono text-gray-800 outline-none resize-none bg-transparent"
                placeholder={t('admin.ui.memory.editPlaceholder')}
                spellCheck={false}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('admin.ui.memory.selectHint')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
