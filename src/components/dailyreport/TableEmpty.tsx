import { CalendarOff } from 'lucide-react';

/**
 * Empty state for the Daily Report tables when no drivers are scheduled.
 * Mirrors the app's other empty states (icon tile + title + subtext) instead
 * of a bare italic line.
 */
export function TableEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        <CalendarOff size={24} className="text-gray-400" strokeWidth={2.2} />
      </div>
      <h3 className="text-lg font-extrabold tracking-tight text-black mb-1.5">
        No drivers scheduled
      </h3>
      <p className="text-sm text-gray-400 font-medium max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}
