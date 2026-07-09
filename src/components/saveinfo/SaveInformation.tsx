import { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import {
  Calendar,
  ClipboardList,
  CalendarOff,
  Users,
  Download,
  CalendarClock,
  Power,
  ShieldAlert,
  Check,
  X,
  Loader2,
  History,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "../../lib/utils";
import { PageHeader } from "../common/PageHeader";
import {
  ExportSection,
  exportMasterSchedule,
  exportDailyReport,
  exportTimeOff,
  exportDriverContacts,
  logExport,
  fetchScheduledDeletions,
  cancelScheduledDeletion,
  ScheduledDeletion,
} from "../../lib/saveExports";

// ── Automatic backup frequencies (UI only — no scheduling yet) ────────────────
const FREQUENCIES = [
  { id: "1w", label: "Every Week", sub: "Weekly" },
  { id: "2w", label: "Every 2 Weeks", sub: "Every other week" },
  { id: "1m", label: "Every Month", sub: "Monthly" },
  { id: "3m", label: "Every 3 Months", sub: "Quarterly" },
  { id: "6m", label: "Every 6 Months", sub: "Semi-annual" },
] as const;
type FrequencyId = (typeof FREQUENCIES)[number]["id"];

// ── Manual export sections — each gets a distinct icon + accent for clarity ───
interface SectionDef {
  id: ExportSection;
  name: string;
  description: string;
  icon: typeof Calendar;
  /** Tailwind classes for the icon chip (bg + text). */
  accent: string;
  /** Whether this section honours the selected date range. */
  usesRange: boolean;
  /** When true, the data is kept in the app after download (not auto-deleted). */
  retained?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: "master_schedule",
    name: "Master Schedule",
    description: "Station assignments across the selected dates.",
    icon: Calendar,
    accent: "bg-blue-50 text-blue-600",
    usesRange: true,
  },
  {
    id: "daily_report",
    name: "Daily Report",
    description: "Roll call, operations & issues per day.",
    icon: ClipboardList,
    accent: "bg-emerald-50 text-emerald-600",
    usesRange: true,
  },
  {
    id: "time_off",
    name: "Time Off & Exceptions",
    description: "Requests overlapping the selected dates.",
    icon: CalendarOff,
    accent: "bg-amber-50 text-amber-600",
    usesRange: true,
  },
  {
    id: "driver_contacts",
    name: "Driver Contacts",
    description: "Full driver roster — kept in the app after download.",
    icon: Users,
    accent: "bg-violet-50 text-violet-600",
    usesRange: false,
    retained: true,
  },
];

const SECTION_BY_ID = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
) as Record<ExportSection, SectionDef>;

const fieldClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 text-sm";

// Strong ease-out — built-in CSS curves feel weak.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const toStr = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : "");

export function SaveInformation() {
  // Automatic backups — local state only (no functionality yet, per spec).
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [frequency, setFrequency] = useState<FrequencyId>("2w");

  // Manual export
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [busySection, setBusySection] = useState<ExportSection | null>(null);

  // Post-download notice ("data will be deleted in 30 days", or retained)
  const [notice, setNotice] = useState<{
    name: string;
    expiresAt: string | null;
    retained: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scheduled deletions (restore section)
  const reduce = useReducedMotion();
  const [deletions, setDeletions] = useState<ScheduledDeletion[]>([]);
  const [deletionsLoading, setDeletionsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refreshDeletions = async () => {
    const rows = await fetchScheduledDeletions();
    setDeletions(rows);
    setDeletionsLoading(false);
  };

  useEffect(() => {
    refreshDeletions();
  }, []);

  const handleRestore = async (id: string) => {
    if (restoringId) return;
    setRestoringId(id);
    const ok = await cancelScheduledDeletion(id);
    if (ok) {
      setDeletions((prev) => prev.filter((d) => d.id !== id));
    } else {
      setErrorMsg("Could not cancel the deletion. Please try again.");
    }
    setRestoringId(null);
  };

  const startStr = toStr(rangeStart);
  const endStr = toStr(rangeEnd);
  const rangeValid = !!startStr && !!endStr && startStr <= endStr;

  const canExport = (section: SectionDef) =>
    section.usesRange ? rangeValid : true;

  const handleExport = async (section: SectionDef) => {
    if (busySection || !canExport(section)) return;
    setBusySection(section.id);
    setErrorMsg(null);
    try {
      let rows = 0;
      switch (section.id) {
        case "master_schedule":
          rows = await exportMasterSchedule(startStr, endStr);
          break;
        case "daily_report":
          rows = await exportDailyReport(startStr, endStr);
          break;
        case "time_off":
          rows = await exportTimeOff(startStr, endStr);
          break;
        case "driver_contacts":
          rows = await exportDriverContacts();
          break;
      }

      // Retained sections (e.g. the driver roster) are never auto-deleted, so we
      // don't log them for the 30-day retention purge.
      let expiresAt: string | null = null;
      if (!section.retained) {
        expiresAt = await logExport(
          section.id,
          section.usesRange ? startStr : null,
          section.usesRange ? endStr : null,
          rows,
        );
        // Surface the new scheduled deletion in the restore section.
        refreshDeletions();
      }
      setNotice({
        name: section.name,
        expiresAt,
        retained: !!section.retained,
      });
    } catch (e: any) {
      console.error("Export failed:", e);
      setErrorMsg(
        `Could not export ${section.name}: ${e.message ?? "unknown error"}`,
      );
    } finally {
      setBusySection(null);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Save Information" />

      {/* ── Section 1 — Automatic Backups ──────────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
              <CalendarClock size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-black leading-tight">
                Automatic Backups
              </h2>
              <p className="text-sm text-gray-400 font-medium">
                Schedule recurring exports of all your data.
              </p>
            </div>
          </div>

          {/* Master enable toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={autoEnabled}
            onClick={() => setAutoEnabled((v) => !v)}
            className={cn(
              "relative w-12 h-7 rounded-full shrink-0 transition-colors duration-200 ease-out cursor-pointer active:scale-95",
              autoEnabled ? "bg-black" : "bg-gray-200",
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                autoEnabled ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {/* Frequency cards */}
        <div
          className={cn(
            "px-6 py-5 transition-opacity duration-200",
            autoEnabled
              ? "opacity-100"
              : "opacity-40 pointer-events-none select-none",
          )}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
            <Power size={11} /> Backup frequency
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FREQUENCIES.map((f) => {
              const active = frequency === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrequency(f.id)}
                  className={cn(
                    "group relative text-left px-4 py-3.5 rounded-xl border transition-[transform,border-color,background-color] duration-150 ease-out cursor-pointer active:scale-[0.97]",
                    active
                      ? "border-black bg-black text-white shadow-sm"
                      : "border-gray-100 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  <span className="block text-sm font-bold tracking-tight">
                    {f.label}
                  </span>
                  <span
                    className={cn(
                      "block text-[11px] font-medium mt-0.5",
                      active ? "text-white/60" : "text-gray-400",
                    )}
                  >
                    {f.sub}
                  </span>
                  <span
                    className={cn(
                      "absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-150 ease-out",
                      active ? "bg-white scale-100" : "scale-0",
                    )}
                  >
                    <Check size={11} className="text-black" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 2 — Manual Export ──────────────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
            <Download size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-black leading-tight">
              Manual Export
            </h2>
            <p className="text-sm text-gray-400 font-medium">
              Pick a date range, then download any section.
            </p>
          </div>
        </div>

        {/* Date range */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                From
              </label>
              <ReactDatePicker
                selected={rangeStart}
                onChange={(date: Date | null) => setRangeStart(date)}
                selectsStart
                startDate={rangeStart}
                endDate={rangeEnd}
                dateFormat="MM/dd/yyyy"
                placeholderText="MM/DD/YYYY"
                className={fieldClass}
                wrapperClassName="w-full"
                popperClassName="rdp-custom"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                To
              </label>
              <ReactDatePicker
                selected={rangeEnd}
                onChange={(date: Date | null) => setRangeEnd(date)}
                selectsEnd
                startDate={rangeStart}
                endDate={rangeEnd}
                minDate={rangeStart ?? undefined}
                dateFormat="MM/dd/yyyy"
                placeholderText="MM/DD/YYYY"
                className={fieldClass}
                wrapperClassName="w-full"
                popperClassName="rdp-custom"
              />
            </div>
          </div>
          {startStr && endStr && !rangeValid && (
            <p className="text-[11px] font-semibold text-red-500 mt-2">
              The “From” date must be on or before the “To” date.
            </p>
          )}
        </div>

        {/* Section cards */}
        <div className="divide-y divide-gray-100">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const busy = busySection === section.id;
            const disabled =
              !canExport(section) || (busySection !== null && !busy);
            return (
              <div
                key={section.id}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-gray-50/50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      section.accent,
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight text-black truncate">
                        {section.name}
                      </h3>
                      {!section.usesRange && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          Full roster
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400 font-medium truncate">
                      {section.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExport(section)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-[transform,background-color,opacity] duration-150 ease-out",
                    disabled
                      ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                      : "bg-black text-white hover:bg-gray-800 active:scale-[0.97] shadow-sm cursor-pointer",
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      Download
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 3 — Restore (scheduled deletions) ──────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-8">
        <div className="flex items-start gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
            <History size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-black leading-tight">
              Scheduled Deletions
            </h2>
            <p className="text-sm text-gray-400 font-medium">
              Exported data is removed after 30 days. Restore an item to keep it
              in the app.
            </p>
          </div>
        </div>

        {deletionsLoading ? (
          <div className="divide-y divide-gray-100">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                    <div className="h-2.5 w-48 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : deletions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12 select-none">
            <div className="w-11 h-11 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>
            <p className="text-sm font-bold text-black">
              Nothing scheduled for deletion
            </p>
            <p className="text-[12px] text-gray-400 font-medium mt-0.5 max-w-xs">
              Anything you export with a deletion timer will show up here, ready
              to restore.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <AnimatePresence mode="popLayout" initial={false}>
              {deletions.map((d, i) => {
                const meta = SECTION_BY_ID[d.section];
                const Icon = meta?.icon ?? Calendar;
                const daysLeft = Math.max(
                  0,
                  differenceInCalendarDays(parseISO(d.expires_at), new Date()),
                );
                const rangeLabel =
                  d.range_start && d.range_end
                    ? `${format(parseISO(d.range_start), "MMM d")} – ${format(parseISO(d.range_end), "MMM d, yyyy")}`
                    : "All data";
                const restoring = restoringId === d.id;
                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      x: reduce ? 0 : 8,
                      transition: { duration: 0.18, ease: EASE_OUT },
                    }}
                    transition={{
                      duration: 0.3,
                      ease: EASE_OUT,
                      delay: reduce ? 0 : i * 0.04,
                    }}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-gray-50/50"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          meta?.accent ?? "bg-gray-50 text-gray-500",
                        )}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold tracking-tight text-black truncate">
                            {meta?.name ?? d.section}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                            {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-400 font-medium truncate">
                          {rangeLabel} · deletes{" "}
                          {format(parseISO(d.expires_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(d.id)}
                      disabled={restoring}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 border bg-white shadow-sm",
                        "transition-[transform,background-color,border-color] duration-150 ease-out",
                        restoring
                          ? "text-gray-300 border-gray-100 cursor-wait"
                          : "text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.97] cursor-pointer",
                      )}
                    >
                      {restoring ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Restore
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Retention notice / error toast ─────────────────────────────────── */}
      <AnimatePresence>
        {notice && (
          <motion.div
            key="notice"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-6 right-6 z-[100] w-[360px] bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/60 overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4">
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  notice.retained
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600",
                )}
              >
                {notice.retained ? (
                  <Check size={17} strokeWidth={3} />
                ) : (
                  <ShieldAlert size={17} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold tracking-tight text-black">
                  {notice.name} downloaded
                </p>
                <p className="text-[12px] text-gray-500 font-medium leading-relaxed mt-0.5">
                  {notice.retained ? (
                    "This data stays in the app — it is not deleted."
                  ) : (
                    <>
                      This data will be deleted from the app
                      {notice.expiresAt
                        ? ` on ${format(new Date(notice.expiresAt), "MMM d, yyyy")}`
                        : " in 30 days"}
                      . It is saved in your downloaded file.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setNotice(null)}
                aria-label="Dismiss"
                className="text-gray-300 hover:text-black transition-colors active:scale-90 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-6 right-6 z-[100] w-[360px] bg-white border border-red-100 rounded-2xl shadow-xl shadow-red-100/40 overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <ShieldAlert size={17} />
              </div>
              <p className="text-[12px] text-gray-600 font-medium leading-relaxed flex-1 min-w-0">
                {errorMsg}
              </p>
              <button
                onClick={() => setErrorMsg(null)}
                aria-label="Dismiss"
                className="text-gray-300 hover:text-black transition-colors active:scale-90 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
