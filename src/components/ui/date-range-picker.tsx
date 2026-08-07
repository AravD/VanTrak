import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  /** Months shown side-by-side in the dropdown. */
  numberOfMonths?: number;
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger button (e.g. to match a form's field style). */
  className?: string;
  disabled?: boolean;
}

/**
 * Single-field date range picker: one button that opens a dropdown calendar
 * where you click the start day then the end day. Replaces paired "From/To"
 * inputs. Writes to whatever two date values the caller maps `range.from` and
 * `range.to` onto — no data-model change needed.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  numberOfMonths = 2,
  align = "start",
  className,
  disabled,
}: DateRangePickerProps) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`
      : format(value.from, "MMM d, yyyy")
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2.5 text-left text-sm transition-colors hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/5 disabled:cursor-not-allowed disabled:opacity-50",
            !value?.from && "text-gray-400",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarIcon size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align={align}>
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => onChange(range)}
          numberOfMonths={numberOfMonths}
          defaultMonth={value?.from}
        />
      </PopoverContent>
    </Popover>
  );
}
