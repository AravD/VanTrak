import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Shared Daily Report UI primitives (used by Roll Call + Operations) ────────

export type Tone = 'green' | 'amber' | 'rose' | 'blue' | 'neutral';

/** Status colour system — a chip (border + bg + text) and its matching dot. */
export const TONES: Record<Tone, { chip: string; dot: string }> = {
  green: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  amber: { chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  rose: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  blue: { chip: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  neutral: { chip: 'border-gray-200 bg-white text-gray-500', dot: 'bg-gray-300' },
};

/**
 * Clean, high-affordance cell input: white, clear border, instant focus ring.
 * Base is left-aligned; add `text-center tabular-nums` for short numeric fields.
 */
export const cellInput =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-[border-color,box-shadow] duration-150 hover:border-gray-300 focus:border-gray-900 focus:outline-none focus:ring-4 focus:ring-black/5';

/** Round initials chip that anchors each driver row. */
export function DriverAvatar({ first, last }: { first?: string; last?: string }) {
  const initials = ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '—';
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
      {initials}
    </span>
  );
}

/** Color-coded status dropdown: leading dot + custom chevron, no native chrome. */
export function StatusSelect({
  value,
  options,
  tone,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  tone: Tone;
  onChange: (value: string) => void;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={cn('relative', className)}>
      <span
        className={cn(
          'pointer-events-none absolute left-3 top-1/2 size-1.5 -translate-y-1/2 rounded-full',
          t.dot,
        )}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full cursor-pointer appearance-none rounded-lg border py-2 pl-7 pr-8 text-sm font-semibold transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-4 focus:ring-black/5',
          t.chip,
        )}
      >
        {options.map((o) => (
          <option key={o} value={o} className="font-medium text-gray-900">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50"
      />
    </div>
  );
}

// ── Time input with an explicit AM/PM toggle ─────────────────────────────────
// Stores a real 24-hour "HH:MM" value; the user types a 12-hour time and picks
// AM/PM (defaults to AM). Click the AM/PM badge to switch.
type Meridiem = 'AM' | 'PM';

function meridiemFrom24(v: string): Meridiem {
  const h = parseInt((v || '').split(':')[0] ?? '', 10);
  return Number.isFinite(h) && h >= 12 ? 'PM' : 'AM';
}

/** 24h "HH:MM" → 12h "H:MM" for display. */
function display12(v: string): string {
  if (!v) return '';
  const [hs, ms] = v.split(':');
  let h = parseInt(hs, 10);
  if (!Number.isFinite(h)) return '';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${(ms ?? '00').padStart(2, '0')}`;
}

/** (12h text, AM/PM) → 24h "HH:MM", or "" when empty. */
function to24(raw12: string, mer: Meridiem): string {
  const digits = raw12.replace(/\D/g, '');
  if (!digits) return '';
  let h: number;
  let m: number;
  if (raw12.includes(':')) {
    const [a, b] = raw12.split(':');
    h = parseInt(a, 10);
    m = parseInt(b || '0', 10);
  } else if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else {
    h = parseInt(digits.slice(0, -2), 10);
    m = parseInt(digits.slice(-2), 10);
  }
  if (!Number.isFinite(h)) return '';
  if (!Number.isFinite(m)) m = 0;
  if (m > 59) m = 59;
  if (h === 0 || h > 12) h = 12;
  const h24 = mer === 'AM' ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TimeInput({
  value,
  onChange,
  disabled,
  className,
  defaultMeridiem = 'AM',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** AM/PM shown for an empty field (Roll Call defaults AM, Operations PM). */
  defaultMeridiem?: Meridiem;
}) {
  const [raw, setRaw] = useState(() => display12(value));
  const [mer, setMer] = useState<Meridiem>(() => (value ? meridiemFrom24(value) : defaultMeridiem));
  const last = useRef(value);

  // Sync when the value changes externally (date nav, autosave refresh, reset).
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setRaw(display12(value));
      setMer(value ? meridiemFrom24(value) : defaultMeridiem);
    }
  }, [value, defaultMeridiem]);

  const commit = (r: string, m: Meridiem) => {
    const v = to24(r, m);
    last.current = v;
    onChange(v);
  };

  const handleBlur = () => {
    setRaw(display12(to24(raw, mer)));
    commit(raw, mer);
  };

  const toggle = () => {
    if (disabled) return;
    const next: Meridiem = mer === 'AM' ? 'PM' : 'AM';
    setMer(next);
    if (raw.trim()) commit(raw, next);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        disabled={disabled}
        onChange={(e) => setRaw(e.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
        onBlur={handleBlur}
        className={cn(
          cellInput,
          'pr-12 text-center tabular-nums',
          disabled && 'cursor-not-allowed bg-gray-50 text-gray-300 hover:border-gray-200',
        )}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        tabIndex={-1}
        aria-label={`Switch to ${mer === 'AM' ? 'PM' : 'AM'}`}
        className={cn(
          'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[11px] font-bold tabular-nums transition-[background-color,transform] duration-150',
          disabled
            ? 'cursor-not-allowed text-gray-300'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95',
        )}
      >
        {mer}
      </button>
    </div>
  );
}

/** Passive autosave indicator (no button — changes persist automatically). */
export function AutosaveStatus({
  saving,
  saveStatus,
}: {
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-1.5 text-sm">
      {saving ? (
        <span className="flex items-center gap-1.5 text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Saving…
        </span>
      ) : saveStatus === 'error' ? (
        <span className="flex items-center gap-1.5 font-medium text-red-500">
          <AlertCircle size={15} /> Couldn't save — check your connection
        </span>
      ) : saveStatus === 'success' ? (
        <span className="flex items-center gap-1.5 font-medium text-green-600">
          <Check size={15} /> All changes saved
        </span>
      ) : (
        <span className="text-gray-400">Changes save automatically</span>
      )}
    </div>
  );
}
