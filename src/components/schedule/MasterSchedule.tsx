import React, { useState, useEffect, MouseEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Driver, DayOfWeek } from "../../types/driver";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function MasterSchedule() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [requirements, setRequirements] = useState<
    Record<string, { okami_min_drivers_needed?: number; da_count?: number }>
  >({});
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [stationValues, setStationValues] = useState<
    Record<string, Record<string, number>>
  >({});
  const [weeklyScheduleId, setWeeklyScheduleId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState("");

  const weekStart = startOfWeek(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchDrivers();
    fetchStations(); // Fetch list immediately
    const init = async () => {
      const scheduleId = await ensureWeeklySchedule();
      if (scheduleId) {
        fetchDailyRequirements(scheduleId);
        fetchStations(scheduleId);
      }
    };
    init();
  }, [currentDate]);

  // Sync DA Count to daily_requirements when drivers or schedule changes
  useEffect(() => {
    if (drivers.length > 0 && weeklyScheduleId) {
      syncDaCounts();
    }
  }, [drivers, weeklyScheduleId]);

  const syncDaCounts = async () => {
    if (!weeklyScheduleId) return;

    const days: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    // Prepare upserts for each day of the week
    const upserts = days.map((dayKey, i) => {
      const dateStr = format(addDays(weekStart, i), "yyyy-MM-dd");
      const count = drivers.filter((d) => d[dayKey]).length;

      return {
        weekly_schedule_id: weeklyScheduleId,
        work_date: dateStr,
        da_count: count,
      };
    });

    const { error } = await supabase
      .from("daily_requirements")
      .upsert(upserts, { onConflict: "weekly_schedule_id,work_date" });

    if (error) {
      console.error("Error syncing DA counts:", error);
    } else {
      // Update local state to reflect the sync
      const updatedMapping = { ...requirements };
      upserts.forEach((u) => {
        if (!updatedMapping[u.work_date]) updatedMapping[u.work_date] = {};
        updatedMapping[u.work_date].da_count = u.da_count;
      });
      setRequirements(updatedMapping);
    }
  };

  const ensureWeeklySchedule = async () => {
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    // Check if exists
    const { data: existing, error: fetchError } = await supabase
      .from("weekly_schedules")
      .select("id")
      .eq("week_start_date", weekStartStr)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error checking weekly schedule:", fetchError);
    }

    if (existing) {
      setWeeklyScheduleId(existing.id);
      return existing.id;
    }

    // Create new
    const weekEndDateStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const { data: created, error } = await supabase
      .from("weekly_schedules")
      .insert({
        week_start_date: weekStartStr,
        week_end_date: weekEndDateStr,
      })
      .select("id")
      .single();

    if (created) {
      setWeeklyScheduleId(created.id);
      return created.id;
    }

    if (error) console.error("Error ensuring weekly schedule:", error);
    return null;
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) console.error("Error fetching drivers:", error);
    else setDrivers(data || []);
  };

  const fetchStations = async (scheduleId?: string) => {
    const { data: stationsData, error } = await supabase
      .from("stations")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching stations:", error);
      return;
    }

    if (stationsData) {
      setStations(stationsData);

      const id = scheduleId || weeklyScheduleId;
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
  const [confirmingDeleteStationId, setConfirmingDeleteStationId] = useState<string | null>(null);

  const handleDeleteStation = async (stationId: string) => {
    await supabase.from("station_values").delete().eq("station_id", stationId);

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
        .insert({ name: newStationName.trim() })
        .select()
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        window.alert(`Error: ${error.message}`);
        throw error;
      }

      console.log("Success adding station:", data);
      await fetchStations(weeklyScheduleId || undefined);
      setIsAddModalOpen(false);
      setNewStationName("");
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
      console.log("No weekly schedule found, attempting to create one...");
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
      console.log("No weekly schedule found, attempting to create one...");
      currentScheduleId = await ensureWeeklySchedule();
    }

    if (!currentScheduleId) {
      window.alert(
        "Cannot save: Weekly schedule could not be initialized. Please refresh.",
      );
      return;
    }

    // Only allow numbers
    const cleanValue = value.replace(/\D/g, "");
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    setRequirements((prev) => ({
      ...prev,
      [date]: { ...prev[date], [field]: numValue as any },
    }));

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

  const getDayAbbreviation = (day: DayOfWeek) =>
    day.charAt(0).toUpperCase() + day.slice(1);

  const getDriversByDay = (dayIndex: number) => {
    const days: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayKey = days[dayIndex];
    return drivers.filter((d) => d[dayKey]);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center mb-16">
        <div className="flex items-center gap-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-black">
            Master Schedule
          </h1>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            + Add Station
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

      <div className="bg-white border-t border-l border-gray-100 rounded-lg overflow-hidden shadow-sm">
        {/* Header Row */}
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

        {/* Okami Row */}
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

        {/* DA Count Row */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/10">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              DA Count
            </span>
          </div>
          {weekDays.map((_, i) => {
            const dayDrivers = getDriversByDay(i);
            return (
              <div
                key={i}
                className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center"
              >
                <span className="text-xs font-black text-blue-700">
                  {dayDrivers.length}
                </span>
              </div>
            );
          })}
        </div>

        {/* Station Rows */}
        {stations.map((station) => (
          <div
            key={station.id}
            className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/5"
          >
            <div className="border-r border-b border-gray-100 flex items-center px-4 group/label bg-gray-50/10 transition-colors">
              {confirmingDeleteStationId === station.id ? (
                <div className="flex items-center gap-1 w-full">
                  <button
                    onClick={() => handleDeleteStation(station.id)}
                    className="text-[9px] font-black uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteStationId(null)}
                    className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest truncate">
                    {station.name}
                  </span>
                  <button
                    onClick={() => setConfirmingDeleteStationId(station.id)}
                    className="opacity-0 group-hover/label:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
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

        {/* Schedule Body */}
        {[...Array(24)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[120px_repeat(7,1fr)] group"
          >
            {/* Row Number */}
            <div className="border-r border-b border-gray-50 bg-gray-50/30 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <span className="text-[10px] font-bold text-gray-400 font-mono">
                {String(rowIndex + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Day Slots */}
            {weekDays.map((_, dayIndex) => {
              const dayDrivers = getDriversByDay(dayIndex);
              const driver = dayDrivers[rowIndex];
              const isToday = isSameDay(weekDays[dayIndex], new Date());

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "min-h-[36px] px-3 py-1 border-r border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors flex items-center justify-center",
                    isToday && "bg-gray-50/20",
                  )}
                >
                  {driver ? (
                    <div className="flex items-center justify-center gap-2 w-full">
                      <span className="text-[13px] font-bold text-gray-900 truncate text-center">
                        {driver.first_name} {driver.last_name}
                      </span>
                      {driver.van_number && (
                        <span className="shrink-0 text-[9px] bg-black text-white px-1 py-0.5 rounded font-black">
                          V{driver.van_number}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Add Station Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-[320px] animate-in fade-in zoom-in duration-150">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Add Station
            </h2>
            <input
              autoFocus
              type="text"
              placeholder="Station name"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-black focus:ring-0 transition-all text-sm font-medium mb-4"
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStation()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStation}
                disabled={isSubmitting}
                className={cn(
                  "flex-1 px-3 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95",
                  isSubmitting
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-800",
                )}
              >
                {isSubmitting ? "Adding..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}