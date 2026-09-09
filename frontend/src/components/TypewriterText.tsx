'use client';

import { useState, useEffect, useRef } from 'react';
import Markdown from './Markdown';

interface TypewriterTextProps {
  content: string;
  speed?: number;
}

export default function TypewriterText({ content, speed = 40 }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const contentRef = useRef(content);
  const prevContentRef = useRef('');

  useEffect(() => {
    const prev = prevContentRef.current;
    prevContentRef.current = content;
    contentRef.current = content;

    const isNewMessage = !content.startsWith(prev) || prev === '';
    if (isNewMessage) {
      indexRef.current = 0;
      setDisplayed('');
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (!content || indexRef.current >= content.length) return;

    const charsPerTick = Math.max(1, Math.round(speed / 20));
    timerRef.current = setInterval(() => {
      const currentContent = contentRef.current;
      const currentIndex = indexRef.current;
      if (currentIndex >= currentContent.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = undefined;
        return;
      }
      const next = Math.min(currentIndex + charsPerTick, currentContent.length);
      indexRef.current = next;
      setDisplayed(currentContent.slice(0, next));
    }, 50);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, speed]);

  const isTyping = indexRef.current < content.length;

  if (!isTyping && displayed) {
    return <Markdown content={content} />;
  }

  return (
    <span>
      <span className="whitespace-pre-wrap break-words">{displayed}</span>
      {isTyping && (
        <span className="inline-block w-[2px] h-[1em] bg-current animate-pulse ml-0.5 align-text-bottom" />
      )}
    </span>
  );
}
