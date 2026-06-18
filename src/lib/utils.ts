import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Expands shorthand clock entry into `HH:MM`.
 *   "4"    -> "04:00"
 *   "430"  -> "04:30"
 *   "1230" -> "12:30"
 *   "4:30" -> "04:30"
 * Returns "" for empty input. Hours clamp to 23, minutes to 59.
 * Intended for use on blur, so the field can be typed freely while focused.
 */
export function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  let hours: number;
  let minutes: number;
  if (digits.length <= 2) {
    hours = parseInt(digits, 10);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = parseInt(digits.slice(0, 1), 10);
    minutes = parseInt(digits.slice(1), 10);
  } else {
    hours = parseInt(digits.slice(0, 2), 10);
    minutes = parseInt(digits.slice(2, 4), 10);
  }

  if (Number.isNaN(hours)) return '';
  if (hours > 23) hours = 23;
  if (minutes > 59) minutes = 59;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
