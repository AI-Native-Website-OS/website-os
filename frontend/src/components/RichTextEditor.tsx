'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 300 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 仅当外部 value 与当前 DOM 不一致时才同步，避免每次键入后重置光标位置
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  }, []);

  const toolbar = [
    { icon: Bold, cmd: 'bold', title: '加粗' },
    { icon: Italic, cmd: 'italic', title: '斜体' },
    { icon: Heading1, cmd: 'formatBlock', val: 'h2', title: '标题1' },
    { icon: Heading2, cmd: 'formatBlock', val: 'h3', title: '标题2' },
    { icon: List, cmd: 'insertUnorderedList', title: '无序列表' },
    { icon: ListOrdered, cmd: 'insertOrderedList', title: '有序列表' },
    { icon: Quote, cmd: 'formatBlock', val: 'blockquote', title: '引用' },
    { icon: Undo, cmd: 'undo', title: '撤销' },
  ];

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isFocused ? 'border-gray-400' : 'border-gray-300'}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
        {toolbar.map((btn) => (
          <button
            key={btn.cmd + (btn.val || '')}
            type="button"
            title={btn.title}
            onMouseDown={(e) => { e.preventDefault(); exec(btn.cmd, btn.val); }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-black transition-colors"
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="px-4 py-3 text-sm leading-relaxed min-h-[200px] focus:outline-none cursor-text"
          style={{ minHeight }}
          data-placeholder={placeholder}
        />
        {(!value || value === '<br>') && !isFocused && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none px-4">
            {placeholder || '请输入内容...'}
          </div>
        )}
      </div>
    </div>
  );
}
