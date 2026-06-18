import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { PageHeader } from "../common/PageHeader";

interface ScheduledDriver {
  driver_id: string;
  first_name: string;
  last_name: string;
}

interface WeekAssignment {
  driver_id: string;
  work_date: string;
  station_id: string | null;
  drivers: ScheduledDriver | null;
}

// Pre-computed pattern so skeleton bars look natural without Math.random()
const SKELETON_DRIVER_PATTERN: number[][] = [
  [20, 0, 24, 16, 22, 0, 18],
  [0, 22, 16, 0, 20, 24, 0],
  [24, 18, 0, 22, 0, 16, 20],
  [16, 0, 20, 24, 18, 0, 22],
  [22, 24, 18, 0, 16, 20, 0],
];

function ScheduleSkeleton({ weekDays }: { weekDays: Date[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-7 w-28 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div className="bg-white border-t border-l border-gray-100 rounded-lg overflow-hidden shadow-sm">
        {/* Day header row */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/50">
          <div className="border-r border-b border-gray-100 h-[52px]" />
          {weekDays.map((_, i) => (
            <div key={i} className="border-r border-b border-gray-100 px-4 py-3 flex flex-col items-center gap-2">
              <div className="h-2 w-7 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Metric rows: Okami, Station, DA Count, Capacity */}
        {['w-10', 'w-16', 'w-14', 'w-16'].map((labelW, i) => (
          <div key={i} className="grid grid-cols-[120px_repeat(7,1fr)]">
            <div className="border-r border-b border-gray-100 flex items-center px-4">
              <div className={cn('h-2 bg-gray-100 rounded animate-pulse', labelW)} />
            </div>
            {weekDays.map((_, j) => (
              <div key={j} className="border-r border-b border-gray-100 h-8" />
            ))}
          </div>
        ))}
        {/* Driver rows */}
        {SKELETON_DRIVER_PATTERN.map((cols, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-[120px_repeat(7,1fr)]">
            <div className="h-[36px] border-r border-b border-gray-50 bg-gray-50/30 flex items-center justify-center">
              <div className="h-2 w-5 bg-gray-100 rounded animate-pulse" />
            </div>
            {cols.map((w, colIndex) => (
              <div key={colIndex} className="h-[36px] px-3 border-r border-b border-gray-50 flex items-center justify-center">
                {w > 0 && (
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 4}px` }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mirrors the "No stations yet" empty state so a first-time user (no stations)
// sees a matching placeholder instead of a misleading full-table skeleton.
function EmptyStateSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center mt-24 text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 animate-pulse mb-6" />
      <div className="h-6 w-40 bg-gray-100 rounded-lg animate-pulse mb-3" />
      <div className="h-3 w-72 bg-gray-100 rounded animate-pulse mb-2" />
      <div className="h-3 w-52 bg-gray-100 rounded animate-pulse mb-8" />
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-6 py-5 max-w-xs w-full text-left">
        <div className="h-2 w-16 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="flex flex-col gap-3">
          {[40, 34, 44, 38].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-100 animate-pulse shrink-0" />
              <div className="h-2.5 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 4}px` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MasterSchedule() {
  const [weekAssignments, setWeekAssignments] = useState<WeekAssignment[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  // stationRequirements[stationId][dateStr] = { okami, da_count, capacity }
  const [stationRequirements, setStationRequirements] = useState<
    Record<string, Record<string, { okami: number | null; da_count: number | null; capacity: number | null }>>
  >({});
  // stationValues[dateStr][stationId] = user-entered numeric value (from station_values table)
  const [stationValues, setStationValues] = useState<Record<string, Record<string, number>>>({});
  const [weeklyScheduleId, setWeeklyScheduleId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationIsDefault, setNewStationIsDefault] = useState(false);
  const [confirmingDeleteStationId, setConfirmingDeleteStationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Remember (across loads) whether the user has stations, so the first-load
  // skeleton matches what's coming: the table skeleton for returning users,
  // the empty-state skeleton for someone who hasn't created a station yet.
  const [knownHasStations, setKnownHasStations] = useState<boolean>(
    () => localStorage.getItem("vt_has_stations") === "true"
  );
  // Per-station UI state (frontend-only — no backend impact)
  const [collapsedStations, setCollapsedStations] = useState<Set<string>>(new Set());

  const weekStart = startOfWeek(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  // Refresh assignments when any driver record changes
  useEffect(() => {
    const channel = supabase
      .channel("drivers-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => {
        if (weeklyScheduleId) fetchAssignments(weeklyScheduleId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weeklyScheduleId]);

  // Refresh assignments when schedule_assignments change (exceptions applied, etc.)
  useEffect(() => {
    if (!weeklyScheduleId) return;
    const channel = supabase
      .channel("assignments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_assignments" }, () => {
        fetchAssignments(weeklyScheduleId);
        fetchStationRequirements(weeklyScheduleId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weeklyScheduleId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setWeekAssignments([]);
      setStations([]);
      setStationRequirements({});
      setStationValues({});
      const scheduleId = await ensureWeeklySchedule();
      if (scheduleId) {
        await Promise.all([
          fetchStations(scheduleId),
          fetchStationRequirements(scheduleId),
          fetchAssignments(scheduleId),
        ]);
      }
      setIsLoading(false);
    };
    init();
  }, [currentDate]);

  const ensureWeeklySchedule = async () => {
    const { data, error } = await supabase.rpc("ensure_weekly_schedule", {
      p_week_start: format(weekStart, "yyyy-MM-dd"),
      p_week_end: format(addDays(weekStart, 6), "yyyy-MM-dd"),
    });
    if (error) {
      console.error("Error ensuring weekly schedule:", error);
      return null;
    }
    setWeeklyScheduleId(data);
    return data as string;
  };

  const fetchAssignments = async (scheduleId: string) => {
    const { data, error } = await supabase
      .from("schedule_assignments")
      .select("driver_id, work_date, station_id, drivers(first_name, last_name)")
      .eq("weekly_schedule_id", scheduleId)
      .eq("assignment_status", "Scheduled");
    if (error) {
      console.error("Error fetching assignments:", error);
      return;
    }
    setWeekAssignments((data as unknown as WeekAssignment[]) || []);
  };

  const fetchStations = async (scheduleId?: string) => {
    const id = scheduleId || weeklyScheduleId;
    const baseQuery = supabase.from("stations").select("id, name, is_default");
    const query = id
      ? baseQuery.or(`is_default.eq.true,created_for_week_id.eq.${id}`)
      : baseQuery.eq("is_default", true);
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching stations:", error);
      return;
    }
    if (data) {
      // Default station always first, then alphabetical
      setStations(
        [...data].sort((a, b) => {
          if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
      );

      const hasStations = data.length > 0;
      localStorage.setItem("vt_has_stations", hasStations ? "true" : "false");
      setKnownHasStations(hasStations);

      if (id) {
        const { data: valuesData } = await supabase
          .from("station_values")
          .select("*")
          .eq("weekly_schedule_id", id);

        if (valuesData) {
          const mapping = (valuesData as any[]).reduce(
            (acc: Record<string, Record<string, number>>, item) => {
              if (!acc[item.work_date]) acc[item.work_date] = {};
              acc[item.work_date][item.station_id] = item.value;
              return acc;
            },
            {}
          );
          setStationValues(mapping);
        }
      }
    }
  };

  const fetchStationRequirements = async (scheduleId: string) => {
    const { data, error } = await supabase
      .from("station_requirements")
      .select("station_id, work_date, okami, da_count, capacity")
      .eq("weekly_schedule_id", scheduleId);
    if (error) {
      console.error("Error fetching station requirements:", error);
      return;
    }
    if (data) {
      const mapping = (data as any[]).reduce(
        (acc: Record<string, Record<string, { okami: number | null; da_count: number | null; capacity: number | null }>>, item) => {
          if (!acc[item.station_id]) acc[item.station_id] = {};
          acc[item.station_id][item.work_date] = {
            okami: item.okami,
            da_count: item.da_count,
            capacity: item.capacity,
          };
          return acc;
        },
        {}
      );
      setStationRequirements(mapping);
    }
  };

  const updateStationRequirement = async (stationId: string, date: string, value: string) => {
    let currentScheduleId = weeklyScheduleId;
    if (!currentScheduleId) {
      currentScheduleId = await ensureWeeklySchedule();
    }
    if (!currentScheduleId) {
      window.alert("Cannot save: Weekly schedule could not be initialized. Please refresh.");
      return;
    }

    const cleanValue = value.replace(/\D/g, "");
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    setStationRequirements((prev) => ({
      ...prev,
      [stationId]: {
        ...prev[stationId],
        [date]: {
          ...prev[stationId]?.[date],
          okami: numValue,
        },
      },
    }));

    const { error } = await supabase.from("station_requirements").upsert(
      { weekly_schedule_id: currentScheduleId, station_id: stationId, work_date: date, okami: numValue },
      { onConflict: "weekly_schedule_id,station_id,work_date" }
    );
    if (error) {
      console.error("Error saving okami value:", error);
      window.alert(`Failed to save okami value: ${error.message}`);
    } else {
      await fetchStationRequirements(currentScheduleId);
    }
  };

  const updateStationValue = async (date: string, stationId: string, value: string) => {
    let currentScheduleId = weeklyScheduleId;
    if (!currentScheduleId) {
      currentScheduleId = await ensureWeeklySchedule();
    }
    if (!currentScheduleId) {
      window.alert("Cannot save: Weekly schedule could not be initialized. Please refresh.");
      return;
    }

    const cleanValue = value.replace(/\D/g, "");
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    setStationValues((prev) => ({
      ...prev,
      [date]: { ...prev[date], [stationId]: numValue as any },
    }));

    const { error } = await supabase.from("station_values").upsert(
      { weekly_schedule_id: currentScheduleId, work_date: date, station_id: stationId, value: numValue },
      { onConflict: "weekly_schedule_id,station_id,work_date" }
    );
    if (error) {
      console.error("Error saving station value:", error);
      window.alert(`Failed to save station value: ${error.message}`);
    }
  };

  const handleDeleteStation = async (stationId: string) => {
    const { error } = await supabase.from("stations").delete().eq("id", stationId);
    if (error) {
      window.alert(`Failed to delete station: ${error.message}`);
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== stationId));
    setStationRequirements((prev) => {
      const next = { ...prev };
      delete next[stationId];
      return next;
    });
    setStationValues((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((date) => {
        const day = { ...next[date] };
        delete day[stationId];
        next[date] = day;
      });
      return next;
    });
    setConfirmingDeleteStationId(null);
  };

  const handleAddStation = async () => {
    if (!newStationName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("stations").insert({
        name: newStationName.trim(),
        is_default: newStationIsDefault,
        created_for_week_id: weeklyScheduleId,
      });
      if (error) throw error;
      await fetchStations(weeklyScheduleId || undefined);
      setNewStationName("");
      setNewStationIsDefault(false);
    } catch (e: any) {
      window.alert(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultStationId = stations.find((s) => s.is_default)?.id;

  // Drivers scheduled > 5 distinct days this week (derived from already-loaded
  // assignments — no extra query; updates with the existing realtime subscriptions).
  const overscheduledDriverIds = (() => {
    const daysByDriver = new Map<string, Set<string>>();
    weekAssignments.forEach((a) => {
      if (!a.driver_id) return;
      if (!daysByDriver.has(a.driver_id)) daysByDriver.set(a.driver_id, new Set());
      daysByDriver.get(a.driver_id)!.add(a.work_date);
    });
    const flagged = new Set<string>();
    daysByDriver.forEach((dates, id) => {
      if (dates.size > 5) flagged.add(id);
    });
    return flagged;
  })();

  // Assignments with null station_id belong to the default station (legacy data)
  const getDriversForStation = (stationId: string, dayIndex: number): ScheduledDriver[] => {
    const dateStr = format(weekDays[dayIndex], "yyyy-MM-dd");
    return weekAssignments
      .filter((a) => {
        if (a.work_date !== dateStr || !a.drivers) return false;
        return (a.station_id ?? defaultStationId) === stationId;
      })
      .map((a) => ({
        driver_id: a.driver_id,
        first_name: a.drivers!.first_name,
        last_name: a.drivers!.last_name,
      }))
      .sort((a, b) => a.first_name.localeCompare(b.first_name));
  };

  const getDACount = (stationId: string, dateStr: string): number =>
    stationRequirements[stationId]?.[dateStr]?.da_count ?? 0;

  const getCapacity = (stationId: string, dateStr: string): number =>
    stationRequirements[stationId]?.[dateStr]?.capacity ?? 0;

  // ── Collapse / menu helpers (UI only) ──────────────────────────────────────
  const isCollapsed = (id: string) => collapsedStations.has(id);

  const toggleCollapse = (id: string) =>
    setCollapsedStations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Tier 1 — title, week navigation, and global actions */}
      <PageHeader title="Master Schedule" className="mb-4">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            aria-label="Previous week"
            className="group p-2 hover:bg-gray-100 rounded-lg transition-[transform,background-color] duration-150 ease-out cursor-pointer active:scale-90"
          >
            <ChevronLeft size={18} className="transition-transform duration-150 ease-out group-hover:-translate-x-0.5" />
          </button>
          <span className="font-bold px-2 min-w-[210px] text-center text-sm tracking-tight tabular-nums">
            {format(weekStart, "MMMM d")} — {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </span>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            aria-label="Next week"
            className="group p-2 hover:bg-gray-100 rounded-lg transition-[transform,background-color] duration-150 ease-out cursor-pointer active:scale-90"
          >
            <ChevronRight size={18} className="transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          </button>
        </div>
      </PageHeader>

      {/* Tier 2 — global station-management toolbar */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          type="button"
          onClick={() => setIsManageModalOpen(true)}
          className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 hover:scale-[1.02] transition-[transform,background-color,box-shadow] duration-150 ease-out shadow-sm cursor-pointer active:scale-[0.97]"
        >
          Manage Stations
        </button>
      </div>

      {/* Skeleton while loading */}
      {isLoading &&
        (knownHasStations ? (
          <ScheduleSkeleton weekDays={weekDays} />
        ) : (
          <EmptyStateSkeleton />
        ))}

      {/* Empty state when no stations exist */}
      {!isLoading && stations.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-24 text-center select-none">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-black mb-2">No stations yet</h2>
          <p className="text-sm text-gray-400 font-medium mb-8 max-w-sm leading-relaxed">
            Get started by creating your first station using the{" "}
            <button
              onClick={() => setIsManageModalOpen(true)}
              className="text-black font-black underline underline-offset-2 hover:opacity-60 transition-opacity cursor-pointer"
            >
              Manage Stations
            </button>{" "}
            button above.
          </p>
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-6 py-5 max-w-xs w-full text-left">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Quick tips</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { icon: "→", text: "Use the sidebar to add drivers to your roster" },
                { icon: "→", text: "Submit time off requests from the sidebar" },
                { icon: "→", text: "Navigate weeks with the arrows in the top right" },
                { icon: "→", text: "Each station gets its own schedule table" },
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="text-gray-300 font-bold text-xs mt-px">{tip.icon}</span>
                  <span className="text-[11px] font-medium text-gray-500 leading-relaxed">{tip.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* One table per active station */}
      {!isLoading && stations.map((station, stationIndex) => {
        const driverRowCount = Math.max(
          5,
          ...weekDays.map((_, i) => getDriversForStation(station.id, i).length)
        );

        return (
          <div key={station.id} className={stationIndex > 0 ? "mt-10" : ""}>
            {/* Station section header — name, badge, and station-specific actions */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() => toggleCollapse(station.id)}
                aria-expanded={!isCollapsed(station.id)}
                className="group flex items-center gap-2.5 cursor-pointer"
              >
                <ChevronDown
                  size={18}
                  className={cn(
                    "text-gray-400 transition-transform duration-200 ease-out group-hover:text-blue-600",
                    isCollapsed(station.id) && "-rotate-90",
                  )}
                />
                <h2 className="text-xl font-extrabold tracking-tight text-black group-hover:text-blue-600 transition-colors">
                  {station.name}
                </h2>
                {station.is_default && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
              </button>
            </div>

            {!isCollapsed(station.id) && (
            <div className="bg-white border-t border-l border-gray-100 rounded-lg overflow-hidden shadow-sm">
              {/* Day header row */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/50">
                <div className="border-r border-b border-gray-100 flex items-center justify-center">
                  <span className="text-[10px] font-black text-gray-300">#</span>
                </div>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "px-4 py-3 border-r border-b border-gray-100 text-center",
                        isToday && "bg-black text-white"
                      )}
                    >
                      <div
                        className={cn(
                          "text-[10px] uppercase font-black tracking-widest mb-0.5",
                          isToday ? "text-gray-400" : "text-gray-400"
                        )}
                      >
                        {format(day, "EEE")}
                      </div>
                      <div className="text-sm font-bold">{format(day, "MMM d")}</div>
                    </div>
                  );
                })}
              </div>

              {/* Okami row — editable, per station */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/20">
                <div className="border-r border-b border-gray-100 flex items-center px-4">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    Okami
                  </span>
                </div>
                {weekDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const okami = stationRequirements[station.id]?.[dateStr]?.okami;
                  return (
                    <div
                      key={i}
                      className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center group/okami"
                    >
                      <div className="relative w-full flex items-center justify-center">
                        {(okami === null || okami === undefined) && (
                          <span className="absolute text-[10px] text-gray-300 font-medium pointer-events-none uppercase tracking-tighter">
                            okami
                          </span>
                        )}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={okami ?? ""}
                          onChange={(e) =>
                            updateStationRequirement(station.id, dateStr, e.target.value)
                          }
                          className="w-full text-center bg-transparent border-none focus:ring-0 text-xs font-bold text-blue-600 relative z-10"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Station value row — editable numeric input per day, matches original design */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/5">
                <div className="border-r border-b border-gray-100 flex items-center px-4">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest truncate">
                    {station.name}
                  </span>
                </div>
                {weekDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const value = stationValues[dateStr]?.[station.id] ?? "";
                  return (
                    <div
                      key={i}
                      className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center group/st"
                    >
                      <div className="relative w-full flex items-center justify-center">
                        {!value && (
                          <span className="absolute text-[10px] text-gray-200 font-bold uppercase tracking-tighter transition-opacity group-hover/st:opacity-40">
                            {station.name}
                          </span>
                        )}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value}
                          onChange={(e) => updateStationValue(dateStr, station.id, e.target.value)}
                          className="w-full text-center bg-transparent border-none focus:ring-0 text-xs font-black text-black relative z-10"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DA Count row — live count of Scheduled assignments for this station */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/10">
                <div className="border-r border-b border-gray-100 flex items-center px-4">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    DA Count
                  </span>
                </div>
                {weekDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      key={i}
                      className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center"
                    >
                      <span className="text-xs font-black text-blue-700">
                        {getDACount(station.id, dateStr)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Capacity row — DA Count minus Okami */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-green-50/20">
                <div className="border-r border-b border-gray-100 flex items-center px-4">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest">
                    Capacity
                  </span>
                </div>
                {weekDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      key={i}
                      className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center"
                    >
                      <span className="text-xs font-black text-black">
                        {getCapacity(station.id, dateStr)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Driver rows — sorted by last name within each station/day */}
              {[...Array(driverRowCount)].map((_, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-[120px_repeat(7,1fr)] group">
                  <div className="h-[36px] border-r border-b border-gray-50 bg-gray-50/30 flex items-center justify-center group-hover:bg-gray-100 transition-colors overflow-hidden">
                    <span className="text-[10px] font-bold text-gray-400 font-mono">
                      {String(rowIndex + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {weekDays.map((_, dayIndex) => {
                    const dayDrivers = getDriversForStation(station.id, dayIndex);
                    const driver = dayDrivers[rowIndex];
                    const isToday = isSameDay(weekDays[dayIndex], new Date());
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "h-[36px] px-3 py-1 border-r border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors flex items-center justify-center overflow-hidden",
                          isToday && "bg-gray-50/20"
                        )}
                      >
                        {driver ? (
                          <span className="inline-flex items-center justify-center gap-1 w-full overflow-hidden">
                            {overscheduledDriverIds.has(driver.driver_id) && (
                              <span
                                title="Driver scheduled for more than 5 days"
                                className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                              />
                            )}
                            <span className="text-[11px] font-semibold text-gray-700 truncate">
                              {driver.first_name} {driver.last_name}
                            </span>
                          </span>
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            )}
          </div>
        );
      })}

      {/* Manage Stations Modal */}
      {isManageModalOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setIsManageModalOpen(false)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-black uppercase tracking-widest text-black">
                Manage Stations
              </h2>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-gray-300 hover:text-black hover:scale-110 active:scale-90 transition-[transform,color] duration-150 ease-out text-lg leading-none font-light cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-3 max-h-[240px] overflow-y-auto">
              {stations.length === 0 ? (
                <p className="text-[11px] text-gray-300 text-center py-4 uppercase tracking-widest">
                  No stations yet
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {stations.map((station) => (
                    <div
                      key={station.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group/row"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {station.name}
                        </span>
                        {station.is_default && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-white bg-black px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {confirmingDeleteStationId === station.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteStation(station.id)}
                            className="text-[9px] font-black uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 active:scale-[0.95] px-2 py-0.5 rounded transition-[transform,background-color] duration-100 ease-out"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteStationId(null)}
                            className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 active:scale-[0.95] px-2 py-0.5 rounded transition-[transform,color] duration-100 ease-out"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 ease-out">
                          <button
                            onClick={() => setConfirmingDeleteStationId(station.id)}
                            aria-label={`Delete ${station.name}`}
                            title="Delete station"
                            className="hover:scale-125 active:scale-90 transition-[transform,color] duration-150 ease-out text-gray-300 hover:text-red-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Add Station
              </p>
              <input
                type="text"
                placeholder="Station name"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:border-black focus:ring-0 transition-all text-sm font-medium mb-3"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStation()}
              />

              {/* Default toggle */}
              <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none w-fit">
                <div
                  onClick={() => setNewStationIsDefault((v) => !v)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative cursor-pointer",
                    newStationIsDefault ? "bg-black" : "bg-gray-200",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform",
                      newStationIsDefault ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Default
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setNewStationName("");
                    setNewStationIsDefault(false);
                    setIsManageModalOpen(false);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-gray-200 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out"
                >
                  Close
                </button>
                <button
                  onClick={handleAddStation}
                  disabled={isSubmitting || !newStationName.trim()}
                  className={cn(
                    "flex-1 px-3 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-[transform,background-color,opacity,box-shadow] duration-150 ease-out shadow-sm active:scale-[0.97]",
                    isSubmitting || !newStationName.trim()
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-gray-800 hover:scale-[1.02]"
                  )}
                >
                  {isSubmitting ? "Adding..." : "Add Station"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
