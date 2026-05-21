import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface ScheduledDriver {
  first_name: string;
  last_name: string;
}

interface WeekAssignment {
  driver_id: string;
  work_date: string;
  drivers: ScheduledDriver | null;
}

export function MasterSchedule() {
  // Scheduled assignments for the current week (status = 'Scheduled' only)
  const [weekAssignments, setWeekAssignments] = useState<WeekAssignment[]>([]);

  // Stores daily requirement for each date
  const [requirements, setRequirements] = useState<
    Record<string, { okami_min_drivers_needed?: number; da_count?: number; capacity?: number }>
  >({});

  // Stores all stations from the stations table
  const [stations, setStations] = useState<{ id: string; name: string; is_default: boolean }[]>([]);

  // Stores station values for each date and station
  const [stationValues, setStationValues] = useState<
    Record<string, Record<string, number>>
  >({});

  // Stores the id of the weekly_schedules row for the current week
  const [weeklyScheduleId, setWeeklyScheduleId] = useState<string | null>(null);

  // Controls which week is currently being displayed
  const [currentDate, setCurrentDate] = useState(new Date());

  // Controls whether the manage stations popup is open
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Stores the station name typed inside the add-station form
  const [newStationName, setNewStationName] = useState("");

  // Tracks the default toggle in the add-station form
  const [newStationIsDefault, setNewStationIsDefault] = useState(false);

  // Tracks which station is pending delete confirmation inside the modal
  const [confirmingDeleteStationId, setConfirmingDeleteStationId] = useState<string | null>(null);

  // Gets the first day of the current week
  const weekStart = startOfWeek(currentDate);

  // Creates an array of 7 dates for the week
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  // Subscribe to driver changes — refresh assignments when a driver is added/removed/updated
  useEffect(() => {
    const channel = supabase
      .channel("drivers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => {
          if (weeklyScheduleId) {
            fetchAssignments(weeklyScheduleId);
            fetchDailyRequirements(weeklyScheduleId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weeklyScheduleId]);

  // Subscribe to assignment changes — keeps the grid and DA count in sync
  // when exceptions are applied or removed
  useEffect(() => {
    if (!weeklyScheduleId) return;

    const channel = supabase
      .channel("assignments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_assignments" },
        () => {
          fetchAssignments(weeklyScheduleId);
          fetchDailyRequirements(weeklyScheduleId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weeklyScheduleId]);

  // Runs whenever the currentDate changes
  useEffect(() => {
    fetchStations();

    const init = async () => {
      const scheduleId = await ensureWeeklySchedule();

      if (scheduleId) {
        fetchDailyRequirements(scheduleId);
        fetchStations(scheduleId);
        fetchAssignments(scheduleId);
      }
    };

    init();
  }, [currentDate]);

  // Finds or creates the weekly_schedules row for the currently displayed week
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

  // Fetches all Scheduled assignments for this week with driver names
  // Drivers on time off have status Sick/Removed and are excluded automatically
  const fetchAssignments = async (scheduleId: string) => {
    const { data, error } = await supabase
      .from("schedule_assignments")
      .select("driver_id, work_date, drivers(first_name, last_name)")
      .eq("weekly_schedule_id", scheduleId)
      .eq("assignment_status", "Scheduled");

    if (error) {
      console.error("Error fetching assignments:", error);
      return;
    }

    setWeekAssignments((data as unknown as WeekAssignment[]) || []);
  };

  // Loads all stations and their values for the current weekly schedule
  const fetchStations = async (scheduleId?: string) => {
    const id = scheduleId || weeklyScheduleId;

    const baseQuery = supabase.from("stations").select("*").order("name");
    const stationsQuery = id
      ? baseQuery.or(`is_default.eq.true,created_for_week_id.eq.${id}`)
      : baseQuery.eq("is_default", true);

    const { data: stationsData, error } = await stationsQuery;

    if (error) {
      console.error("Error fetching stations:", error);
      return;
    }

    if (stationsData) {
      setStations(stationsData);

      if (id) {
        const { data: valuesData } = await supabase
          .from("station_values")
          .select("*")
          .eq("weekly_schedule_id", id);

        if (valuesData) {
          const mapping = valuesData.reduce((acc: any, item: any) => {
            if (!acc[item.work_date]) acc[item.work_date] = {};
            acc[item.work_date][item.station_id] = item.value;
            return acc;
          }, {});

          setStationValues(mapping);
        }
      }
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeleteStation = async (stationId: string) => {
    const { error } = await supabase
      .from("stations")
      .delete()
      .eq("id", stationId);

    if (error) {
      console.error("Error deleting station:", error);
      window.alert(`Failed to delete station: ${error.message}`);
      return;
    }

    setStations((prev) => prev.filter((s) => s.id !== stationId));

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
      const { data, error } = await supabase
        .from("stations")
        .insert({ name: newStationName.trim(), is_default: newStationIsDefault, created_for_week_id: weeklyScheduleId })
        .select()
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        window.alert(`Error: ${error.message}`);
        throw error;
      }

      console.log("Success adding station:", data);

      await fetchStations(weeklyScheduleId || undefined);

      setNewStationName("");
      setNewStationIsDefault(false);
    } catch (error: any) {
      console.error("Exception adding station:", error);

      if (!error.message?.includes("Supabase credentials not found")) {
        window.alert(`System Error: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStationValue = async (
    date: string,
    stationId: string,
    value: string,
  ) => {
    let currentScheduleId = weeklyScheduleId;

    if (!currentScheduleId) {
      currentScheduleId = await ensureWeeklySchedule();
    }

    if (!currentScheduleId) {
      window.alert(
        "Cannot save: Weekly schedule could not be initialized. Please refresh.",
      );
      return;
    }

    const cleanValue = value.replace(/\D/g, "");
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    setStationValues((prev) => ({
      ...prev,
      [date]: { ...prev[date], [stationId]: numValue as any },
    }));

    const { error } = await supabase.from("station_values").upsert(
      {
        weekly_schedule_id: currentScheduleId,
        work_date: date,
        station_id: stationId,
        value: numValue,
      },
      { onConflict: "weekly_schedule_id,station_id,work_date" },
    );

    if (error) {
      console.error("Error saving station value:", error);
      window.alert(`Failed to save station value: ${error.message}`);
    }
  };

  const fetchDailyRequirements = async (scheduleId?: string) => {
    const id = scheduleId || weeklyScheduleId;

    if (!id) return;

    const { data, error } = await supabase
      .from("daily_requirements")
      .select("*")
      .eq("weekly_schedule_id", id);

    if (error) {
      console.error("Error fetching daily requirements:", error);
      return;
    }

    if (data) {
      const mapping = data.reduce(
        (acc: any, item: any) => ({
          ...acc,
          [item.work_date]: {
            okami_min_drivers_needed: item.okami_min_drivers_needed,
            da_count: item.da_count,
            capacity: item.capacity,
          },
        }),
        {},
      );

      setRequirements(mapping);
    }
  };

  const updateRequirement = async (
    date: string,
    field: "okami_min_drivers_needed" | "da_count",
    value: string,
  ) => {
    let currentScheduleId = weeklyScheduleId;

    if (!currentScheduleId) {
      currentScheduleId = await ensureWeeklySchedule();
    }

    if (!currentScheduleId) {
      window.alert(
        "Cannot save: Weekly schedule could not be initialized. Please refresh.",
      );
      return;
    }

    const cleanValue = value.replace(/\D/g, "");
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    setRequirements((prev) => {
      const updated = { ...prev[date], [field]: numValue as any };
      updated.capacity =
        (updated.da_count ?? 0) - (updated.okami_min_drivers_needed ?? 0);
      return { ...prev, [date]: updated };
    });

    const { error } = await supabase.from("daily_requirements").upsert(
      {
        weekly_schedule_id: currentScheduleId,
        work_date: date,
        [field]: numValue,
      },
      { onConflict: "weekly_schedule_id,work_date" },
    );

    if (error) {
      console.error(`Error saving ${field}:`, error);
      window.alert(`Failed to save requirement: ${error.message}`);
    }
  };

  // Returns drivers with Scheduled status for a given day
  // Drivers on time off are excluded because their assignment_status is Sick/Removed
  const getDriversByDay = (dayIndex: number): ScheduledDriver[] => {
    const dateStr = format(weekDays[dayIndex], "yyyy-MM-dd");
    return weekAssignments
      .filter((a) => a.work_date === dateStr && a.drivers)
      .map((a) => a.drivers!)
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  };

  const driverRowCount = Math.max(
    5,
    ...weekDays.map((_, i) => getDriversByDay(i).length),
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Top page header with title, add-station button, and week controls */}
      <header className="flex justify-between items-center mb-16">
        <div className="flex items-center gap-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-black">
            Master Schedule
          </h1>

          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            Manage Stations
          </button>
        </div>

        <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="p-2 hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>

          <span className="font-bold px-4 min-w-[220px] text-center text-sm tracking-tight">
            {format(weekStart, "MMMM d")} —{" "}
            {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </span>

          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="p-2 hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Main schedule grid container */}
      <div className="bg-white border-t border-l border-gray-100 rounded-lg overflow-hidden shadow-sm">
        {/* Header row showing each day of the week */}
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
                  isToday && "bg-black text-white",
                )}
              >
                <div
                  className={cn(
                    "text-[10px] uppercase font-black tracking-widest mb-0.5",
                    isToday ? "text-gray-400" : "text-gray-400",
                  )}
                >
                  {format(day, "EEE")}
                </div>

                <div className="text-sm font-bold">{format(day, "MMM d")}</div>
              </div>
            );
          })}
        </div>

        {/* Okami row */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/20">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              Okami
            </span>
          </div>

          {weekDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");

            return (
              <div
                key={i}
                className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center group/okami"
              >
                <div className="relative w-full flex items-center justify-center">
                  {!requirements[dateStr]?.okami_min_drivers_needed && (
                    <span className="absolute text-[10px] text-gray-300 font-medium pointer-events-none uppercase tracking-tighter">
                      okami
                    </span>
                  )}

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      requirements[dateStr]?.okami_min_drivers_needed ?? ""
                    }
                    onChange={(e) =>
                      updateRequirement(
                        dateStr,
                        "okami_min_drivers_needed",
                        e.target.value,
                      )
                    }
                    className="w-full text-center bg-transparent border-none focus:ring-0 text-xs font-bold text-blue-600 relative z-10"
                    placeholder=""
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic station rows */}
        {stations.map((station) => (
          <div
            key={station.id}
            className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/5"
          >
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
                      onChange={(e) =>
                        updateStationValue(dateStr, station.id, e.target.value)
                      }
                      className="w-full text-center bg-transparent border-none focus:ring-0 text-xs font-black text-black relative z-10"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* DA Count row — reads from daily_requirements (kept in sync by triggers) */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/10">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              DA Count
            </span>
          </div>

          {weekDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daCount = requirements[dateStr]?.da_count ?? getDriversByDay(i).length;

            return (
              <div
                key={i}
                className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center"
              >
                <span className="text-xs font-black text-blue-700">
                  {daCount}
                </span>
              </div>
            );
          })}
        </div>

        

        {/* Capacity row */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-green-50/20">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-black uppercase tracking-widest">
              Capacity
            </span>
          </div>

          {weekDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const capacity = requirements[dateStr]?.capacity ?? 0;

            return (
              <div
                key={i}
                className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center"
              >
                <span className="text-xs font-black text-black">
                  {capacity}
                </span>
              </div>
            );
          })}
        </div>

        {/* Schedule body */}
        {[...Array(driverRowCount)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[120px_repeat(7,1fr)] group"
          >
            <div className="h-[36px] border-r border-b border-gray-50 bg-gray-50/30 flex items-center justify-center group-hover:bg-gray-100 transition-colors overflow-hidden">
              <span className="text-[10px] font-bold text-gray-400 font-mono">
                {String(rowIndex + 1).padStart(2, "0")}
              </span>
            </div>

            {weekDays.map((_, dayIndex) => {
              const dayDrivers = getDriversByDay(dayIndex);
              const driver = dayDrivers[rowIndex];
              const isToday = isSameDay(weekDays[dayIndex], new Date());

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "h-[36px] px-3 py-1 border-r border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors flex items-center justify-center overflow-hidden",
                    isToday && "bg-gray-50/20",
                  )}
                >
                  {driver ? (
                    <span className="text-[11px] font-semibold text-gray-700 truncate text-center w-full">
                      {driver.first_name} {driver.last_name}
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

      {/* Manage Stations Modal */}
      {isManageModalOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setIsManageModalOpen(false)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] animate-in fade-in zoom-in duration-150 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-black uppercase tracking-widest text-black">
                Manage Stations
              </h2>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-gray-300 hover:text-black transition-colors text-lg leading-none font-light cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Station list */}
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
                            className="text-[9px] font-black uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteStationId(null)}
                            className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteStationId(station.id)}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new station form */}
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
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={handleAddStation}
                  disabled={isSubmitting || !newStationName.trim()}
                  className={cn(
                    "flex-1 px-3 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95",
                    isSubmitting || !newStationName.trim()
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-gray-800",
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
