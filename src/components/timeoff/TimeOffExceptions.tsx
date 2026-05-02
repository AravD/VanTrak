import { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { supabase } from "../../lib/supabase";
import { Driver } from "../../types/driver";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface Exception {
  id: string;
  driver_id: string;
  weekly_schedule_id: string | null;
  exception_type: string;
  start_date: string;
  end_date: string;
  remove_from_schedule: boolean;
  makeup_required: boolean;
  makeup_date: string | null;
  notes: string | null;
  status: "Active" | "Resolved" | "Cancelled";
  created_at: string;
  drivers?: { first_name: string; last_name: string };
}

const EXCEPTION_TYPES = ["Time Off", "Sick", "Other"];

const statusColors = {
  Active: "bg-green-100 text-green-700 border-green-200",
  Resolved: "bg-blue-100 text-blue-700 border-blue-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
};

export function TimeOffExceptions() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingException, setEditingException] = useState<Exception | null>(
    null,
  );

  useEffect(() => {
    fetchExceptions();
  }, []);

  const fetchExceptions = async () => {
    const { data, error } = await supabase
      .from("schedule_exceptions")
      .select("*, drivers(first_name, last_name)")
      .order("start_date", { ascending: false });

    if (error) console.error("Error fetching exceptions:", error);
    else setExceptions((data as Exception[]) || []);
  };

  const handleDelete = async (id: string) => {
    const { data, error } = await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      alert(`Supabase error: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      setExceptions((prev) => prev.filter((e) => e.id !== id));
      setIsModalOpen(false);
    } else {
      alert("Deletion failed: No record found or permission denied.");
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Time Off Requests
          </h1>
        </div>

        <button
          onClick={() => {
            setEditingException(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
        >
          <Plus size={20} />
          Add Exception
        </button>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-y-auto max-h-[420px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50/80 backdrop-blur-sm text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
                <th className="px-6 py-4 w-12 text-center">#</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Exception Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Makeup</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {exceptions.map((exc, index) => (
                <tr
                  key={exc.id}
                  onClick={() => {
                    setEditingException(exc);
                    setIsModalOpen(true);
                  }}
                  className="hover:bg-gray-50/30 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-bold text-gray-400 font-mono">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-black">
                      {exc.drivers
                        ? `${exc.drivers.first_name} ${exc.drivers.last_name}`
                        : "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">
                      {exc.exception_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-medium text-gray-500">
                      {formatDate(exc.start_date)}
                      {exc.end_date && exc.end_date !== exc.start_date && (
                        <> — {formatDate(exc.end_date)}</>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tighter w-fit",
                          exc.makeup_required
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-gray-100 text-gray-400 border-gray-200",
                        )}
                      >
                        {exc.makeup_required ? "Required" : "None"}
                      </span>
                      {exc.makeup_required && exc.makeup_date && (
                        <span className="text-[10px] text-gray-400 font-medium">
                          {formatDate(exc.makeup_date)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className="text-xs text-gray-500 max-w-[200px] truncate"
                      title={exc.notes || ""}
                    >
                      {exc.notes || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter",
                        statusColors[exc.status as keyof typeof statusColors],
                      )}
                    >
                      {exc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {exceptions.length === 0 && (
            <div className="py-20 text-center text-gray-400 italic">
              No exceptions recorded. Add one to get started.
            </div>
          )}
        </div>
      </div>

      <CalendarView exceptions={exceptions} />

      <AnimatePresence>
        {isModalOpen && (
          <ExceptionModal
            onClose={() => setIsModalOpen(false)}
            onSave={() => {
              setIsModalOpen(false);
              fetchExceptions();
            }}
            onDelete={handleDelete}
            exception={editingException}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarView({ exceptions }: { exceptions: Exception[] }) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const getExceptionsForDay = (dateStr: string): Exception[] =>
    exceptions.filter(
      (exc) => exc.start_date <= dateStr && dateStr <= exc.end_date,
    );

  const prevMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight text-black">
          Calendar View
        </h2>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-black transition-colors font-bold text-sm px-1"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-black min-w-[140px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-black transition-colors font-bold text-sm px-1"
          >
            ›
          </button>
        </div>
      </div>

      <MonthCalendar
        month={currentMonth}
        getExceptionsForDay={getExceptionsForDay}
      />
    </div>
  );
}

function MonthCalendar({
  month,
  getExceptionsForDay,
}: {
  month: Date;
  getExceptionsForDay: (dateStr: string) => Exception[];
}) {
  const today = new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const dayExceptions = inMonth ? getExceptionsForDay(dateStr) : [];
          const overflow = dayExceptions.length > 4;
          const visible = dayExceptions.slice(0, 4);

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[120px] p-2 border-r border-b border-gray-50 last:border-r-0 flex flex-col group hover:bg-gray-50/60 transition-colors",
                !inMonth && "bg-gray-50/30",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full transition-colors",
                  isToday
                    ? "bg-black text-white group-hover:bg-white group-hover:text-black group-hover:border group-hover:border-gray-300"
                    : inMonth
                      ? "text-gray-700 group-hover:bg-gray-200"
                      : "text-gray-300",
                )}
              >
                {format(day, "d")}
              </span>

              <div className="flex flex-col gap-0.5">
                {visible.map((exc) => (
                  <span
                    key={exc.id}
                    className="text-[9px] font-semibold text-white bg-gray-700 rounded px-1 py-0.5 truncate leading-tight"
                    title={`${exc.drivers?.first_name} ${exc.drivers?.last_name} — ${exc.exception_type}`}
                  >
                    {exc.drivers?.first_name}
                  </span>
                ))}
                {overflow && (
                  <span className="text-[9px] font-bold text-gray-400 px-1">
                    +{dayExceptions.length - 2} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExceptionModal({
  onClose,
  onSave,
  onDelete,
  exception,
}: {
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: string) => Promise<void>;
  exception: Exception | null;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState<Partial<Exception>>(
    exception || {
      driver_id: "",
      exception_type: "Time Off",
      start_date: "",
      end_date: "",
      remove_from_schedule: true,
      makeup_required: false,
      makeup_date: null,
      notes: "",
      status: "Active",
    },
  );

  useEffect(() => {
    supabase
      .from("drivers")
      .select("*")
      .order("first_name", { ascending: true })
      .then(({ data }) => setDrivers(data || []));
  }, []);

  const save = async () => {
    if (!formData.driver_id) {
      setStatusMessage({ type: "error", text: "Please select a driver." });
      return;
    }
    if (!formData.start_date) {
      setStatusMessage({ type: "error", text: "Start date is required." });
      return;
    }
    if (!formData.end_date) {
      setStatusMessage({ type: "error", text: "End date is required." });
      return;
    }
    if (formData.end_date < formData.start_date) {
      setStatusMessage({
        type: "error",
        text: "End date must be on or after start date.",
      });
      return;
    }
    if (
      formData.makeup_required &&
      formData.makeup_date &&
      formData.makeup_date <= formData.end_date
    ) {
      setStatusMessage({
        type: "error",
        text: "Makeup date must be after the end date.",
      });
      return;
    }

    setStatusMessage(null);
    setIsSaving(true);

    const payload = {
      driver_id: formData.driver_id,
      exception_type: formData.exception_type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      remove_from_schedule: formData.remove_from_schedule ?? true,
      makeup_required: formData.makeup_required ?? false,
      makeup_date: formData.makeup_required
        ? formData.makeup_date || null
        : null,
      notes: formData.notes || null,
      status: formData.status,
    };

    try {
      if (exception?.id) {
        const { error } = await supabase
          .from("schedule_exceptions")
          .update(payload)
          .eq("id", exception.id);
        if (error) setStatusMessage({ type: "error", text: error.message });
        else onSave();
      } else {
        const { error } = await supabase
          .from("schedule_exceptions")
          .insert([payload]);
        if (error) setStatusMessage({ type: "error", text: error.message });
        else onSave();
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Unexpected error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (exception?.id) {
      try {
        await onDelete(exception.id);
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: err.message || "Failed to delete",
        });
      }
    }
  };

  const toDate = (str: string | null | undefined): Date | null =>
    str ? parseISO(str) : null;
  const toStr = (date: Date | null): string =>
    date ? format(date, "yyyy-MM-dd") : "";

  const field =
    "w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 text-sm";

  const toggle = (active: boolean) =>
    cn(
      "w-full py-2.5 rounded-xl border font-bold text-sm transition-all",
      active
        ? "bg-black text-white border-black shadow-lg shadow-black/10"
        : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200",
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
      >
        <h2 className="text-2xl font-bold mb-6 tracking-tight">
          {exception ? "Edit Exception" : "Add Exception"}
        </h2>

        {statusMessage && (
          <div
            className={cn(
              "p-3 rounded-xl mb-6 text-sm font-medium",
              statusMessage.type === "error"
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-green-50 text-green-600 border border-green-100",
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Driver */}
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Driver
            </label>
            <select
              value={formData.driver_id}
              onChange={(e) =>
                setFormData({ ...formData, driver_id: e.target.value })
              }
              className={field}
            >
              <option value="">Select Driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Exception Type */}
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Exception Type
            </label>
            <select
              value={formData.exception_type}
              onChange={(e) =>
                setFormData({ ...formData, exception_type: e.target.value })
              }
              className={field}
            >
              {EXCEPTION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Start Date
            </label>
            <ReactDatePicker
              selected={toDate(formData.start_date)}
              onChange={(date: Date | null) =>
                setFormData({ ...formData, start_date: toStr(date) })
              }
              dateFormat="MM/dd/yyyy"
              placeholderText="MM/DD/YYYY"
              className={field}
              wrapperClassName="w-full"
              popperClassName="rdp-custom"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              End Date
            </label>
            <ReactDatePicker
              selected={toDate(formData.end_date)}
              onChange={(date: Date | null) =>
                setFormData({ ...formData, end_date: toStr(date) })
              }
              dateFormat="MM/dd/yyyy"
              placeholderText="MM/DD/YYYY"
              className={field}
              wrapperClassName="w-full"
              popperClassName="rdp-custom"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as Exception["status"],
                })
              }
              className={field}
            >
              <option>Active</option>
              <option>Resolved</option>
              <option>Cancelled</option>
            </select>
          </div>

          {/* Remove from Schedule */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Remove from Schedule
            </label>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  remove_from_schedule: !formData.remove_from_schedule,
                })
              }
              className={toggle(formData.remove_from_schedule ?? true)}
            >
              {formData.remove_from_schedule ? "Yes" : "No"}
            </button>
          </div>

          {/* Makeup Required */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Makeup Required
            </label>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  makeup_required: !formData.makeup_required,
                  makeup_date: !formData.makeup_required
                    ? formData.makeup_date
                    : null,
                })
              }
              className={toggle(formData.makeup_required ?? false)}
            >
              {formData.makeup_required ? "Yes" : "No"}
            </button>
          </div>

          {/* Makeup Date — only shown when makeup is required */}
          <div className="space-y-1.5">
            <label
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                formData.makeup_required ? "text-gray-400" : "text-gray-200",
              )}
            >
              Makeup Date
            </label>
            <ReactDatePicker
              selected={toDate(formData.makeup_date)}
              onChange={(date: Date | null) =>
                setFormData({ ...formData, makeup_date: toStr(date) || null })
              }
              disabled={!formData.makeup_required}
              dateFormat="MM/dd/yyyy"
              placeholderText="MM/DD/YYYY"
              className={cn(
                field,
                !formData.makeup_required && "opacity-30 cursor-not-allowed",
              )}
              wrapperClassName="w-full"
              popperClassName="rdp-custom"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Notes
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {isConfirmingDelete ? (
            <>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
              >
                Confirm Delete
              </button>
            </>
          ) : (
            <>
              {exception && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-4 py-3 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center group"
                  title="Delete Exception"
                >
                  <Trash2
                    size={20}
                    className="group-hover:scale-110 transition-transform"
                  />
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className={cn(
                  "flex-1 px-6 py-3 rounded-xl bg-black text-white font-bold transition-all shadow-lg shadow-gray-200",
                  isSaving
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-800",
                )}
              >
                {isSaving ? "Saving..." : "Save Exception"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
