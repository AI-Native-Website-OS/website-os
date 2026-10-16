'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

const POP_WIDTH = 280;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(s?: string): Date | null {
  if (!s || s.length < 10) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start?: string;
  end?: string;
  onChange: (start?: string, end?: string) => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState(() => {
    const base = parseKey(start) || new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - POP_WIDTH, window.innerWidth - POP_WIDTH - 8));
    setCoords({ top: r.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (open) updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords]);

  const startKey = start ? start.slice(0, 10) : '';
  const endKey = end ? end.slice(0, 10) : '';
  const intlLocale = locale === 'en' ? 'en-US' : 'zh-CN';

  const toggleOpen = () => {
    if (!open) {
      const base = parseKey(start) || new Date();
      setView({ year: base.getFullYear(), month: base.getMonth() });
    }
    setOpen((o) => !o);
  };

  const handleDay = (day: Date) => {
    const key = toKey(day);
    if (key < todayKey) return;
    if (!startKey || (startKey && endKey)) {
      onChange(key, undefined);
      return;
    }
    if (key < startKey) {
      onChange(key, undefined);
    } else {
      onChange(startKey, key);
    }
  };

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const first = new Date(view.year, view.month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale, { weekday: 'narrow' });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2024, 0, 1 + i)));
  const monthLabel = new Intl.DateTimeFormat(intlLocale, { year: 'numeric', month: 'long' }).format(first);
  const todayKey = toKey(new Date());

  const label = startKey ? (endKey ? `${startKey} ~ ${endKey}` : `${startKey} ~ …`) : t('admin.ui.settings.noticeDateRange');

  const popover = open && coords && (
    <div
      ref={popRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, width: POP_WIDTH }}
      className="z-[100] bg-white border border-gray-200 rounded-xl shadow-lg p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-900">{monthLabel}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((w, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} />;
          const key = toKey(c);
          const disabled = key < todayKey;
          const isStart = key === startKey;
          const isEnd = key === endKey;
          const inRange = !!startKey && !!endKey && key > startKey && key < endKey;
          const isToday = key === todayKey;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => handleDay(c)}
              className={cn(
                'h-8 rounded-md text-sm transition-colors',
                disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : isStart || isEnd
                    ? 'bg-black text-white'
                    : inRange
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-100',
                !disabled && isToday && !isStart && !isEnd && 'font-semibold text-black'
              )}
            >
              {c.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => onChange(undefined, undefined)}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          {t('common.clear')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-gray-900 hover:text-black"
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1.5 w-[16rem] px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className={cn('truncate', startKey ? 'text-gray-700' : 'text-gray-400')}>{label}</span>
      </button>

      {popover && typeof document !== 'undefined' && createPortal(popover, document.body)}
    </div>
  );
}
