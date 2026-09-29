'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DateFieldProps {
  /** ISO value, "YYYY-MM-DD" — the same shape a native date input holds. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-03" → "03/09/2026" */
const toDisplay = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

/** "03/09/2026" → "2026-09-03", or "" when the date is not a real one. */
const toIso = (text: string): string => {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const probe = new Date(year, month - 1, day);
  // Rejects 31/02 and friends: the Date constructor rolls them over.
  if (probe.getDate() !== day || probe.getMonth() !== month - 1) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
};

/**
 * A date field that always reads DD/MM/YYYY.
 *
 * A native date input renders in the browser's own locale, so the same page
 * shows 09/03/2026 on one machine and 03/09/2026 on another — confusing next
 * to dates the app formats itself. The text box here is ours, while the native
 * picker stays behind the calendar icon for people who prefer clicking.
 */
export function DateField({
  value,
  onChange,
  className = '',
  disabled = false,
  min,
  max,
  placeholder = 'JJ/MM/AAAA',
}: DateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleText = (text: string) => {
    // Typing is free-form until it parses; an empty box clears the filter.
    if (text.trim() === '') {
      onChange('');
      return;
    }
    const iso = toIso(text);
    if (iso) onChange(iso);
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    // showPicker is not in every browser yet; clicking the input is the fallback.
    if (typeof (el as any).showPicker === 'function') {
      (el as any).showPicker();
    } else {
      el.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Input
        type="text"
        inputMode="numeric"
        defaultValue={toDisplay(value)}
        key={value}
        onChange={(e) => handleText(e.target.value)}
        onBlur={(e) => {
          // Snap back to the stored date when what was typed never parsed.
          const iso = toIso(e.target.value);
          if (!iso && e.target.value.trim() !== '') {
            e.target.value = toDisplay(value);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-9 tabular-nums"
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label={placeholder}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        // Kept in the layout but invisible: a display:none input cannot open
        // its picker in several browsers.
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
}
