import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Driver, DayOfWeek } from "../../types/driver";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function MasterSchedule() {
  // Stores all drivers from the drivers table
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Stores daily requirement for each date
  const [requirements, setRequirements] = useState<
    Record<string, { okami_min_drivers_needed?: number; da_count?: number; capacity?: number }>
  >({});

  // Stores all stations from the stations table
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

  // Stores station values for each date and station
  const [stationValues, setStationValues] = useState<
    Record<string, Record<string, number>>
  >({});

  // Stores the id of the weekly_schedules row for the current week
  const [weeklyScheduleId, setWeeklyScheduleId] = useState<string | null>(null);

  // Controls which week is currently being displayed
  const [currentDate, setCurrentDate] = useState(new Date());

  // Controls whether the add station popup is open
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Stores the station name typed inside the add-station popup
  const [newStationName, setNewStationName] = useState("");

  // Gets the first day of the current week
  const weekStart = startOfWeek(currentDate);

  // Creates an array of 7 dates for the week
  // Example: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  // Subscribe to real-time driver changes so DA Count stays accurate when drivers are added or deleted elsewhere
  useEffect(() => {
    const channel = supabase
      .channel("drivers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => {
          fetchDrivers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Runs whenever the currentDate changes
  // This loads drivers, stations, weekly schedule, daily requirements, and station values
  useEffect(() => {
    fetchDrivers();

    // Fetch station names immediately
    fetchStations();

    // Create or find the weekly schedule for the selected week
    const init = async () => {
      const scheduleId = await ensureWeeklySchedule();

      // Once the schedule exists, fetch requirement rows and station values for it
      if (scheduleId) {
        fetchDailyRequirements(scheduleId);
        fetchStations(scheduleId);
      }
    };

    init();
  }, [currentDate]);

  // Runs when drivers or weeklyScheduleId changes
  // This automatically updates the DA Count row based on how many drivers work each day
  useEffect(() => {
    if (weeklyScheduleId) {
      syncDaCounts();
    }
  }, [drivers, weeklyScheduleId]);

  // Automatically calculates DA Count for each day and saves it to daily_requirements
  const syncDaCounts = async () => {
    if (!weeklyScheduleId) return;

    // These match the boolean columns in the drivers table
    const days: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    // Build one database row for each day of the week
    const upserts = days.map((dayKey, i) => {
      const dateStr = format(addDays(weekStart, i), "yyyy-MM-dd");

      // Count how many drivers have this day marked true
      const count = drivers.filter((d) => d[dayKey]).length;

      return {
        weekly_schedule_id: weeklyScheduleId,
        work_date: dateStr,
        da_count: count,
      };
    });

    // Insert or update the daily_requirements rows
    const { error } = await supabase
      .from("daily_requirements")
      .upsert(upserts, { onConflict: "weekly_schedule_id,work_date" });

    if (error) {
      console.error("Error syncing DA counts:", error);
    } else {
      // Update local React state so the screen updates immediately
      setRequirements((prev) => {
        const updatedMapping = { ...prev };

        upserts.forEach((u) => {
          updatedMapping[u.work_date] = {
            ...updatedMapping[u.work_date],
            da_count: u.da_count,
          };
        });

        return updatedMapping;
      });
    }
  };

  // Finds or creates the weekly_schedules row for the currently displayed week
  const ensureWeeklySchedule = async () => {
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    // Check if a weekly schedule already exists for this week
    const { data: existing, error: fetchError } = await supabase
      .from("weekly_schedules")
      .select("id")
      .eq("week_start_date", weekStartStr)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error checking weekly schedule:", fetchError);
    }

    // If it already exists, store and return the schedule id
    if (existing) {
      setWeeklyScheduleId(existing.id);
      return existing.id;
    }

    // If it does not exist, create a new weekly schedule row
    const weekEndDateStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

    const { data: created, error } = await supabase
      .from("weekly_schedules")
      .insert({
        week_start_date: weekStartStr,
        week_end_date: weekEndDateStr,
      })
      .select("id")
      .single();

    // Save the newly created schedule id
    if (created) {
      setWeeklyScheduleId(created.id);
      return created.id;
    }

    if (error) console.error("Error ensuring weekly schedule:", error);

    return null;
  };

  // Loads all drivers from Supabase and sorts them by last name
  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) console.error("Error fetching drivers:", error);
    else setDrivers(data || []);
  };

  // Loads all stations and their values for the current weekly schedule
  const fetchStations = async (scheduleId?: string) => {
    // Get all station rows
    const { data: stationsData, error } = await supabase
      .from("stations")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching stations:", error);
      return;
    }

    if (stationsData) {
      // Save station list in React state
      setStations(stationsData);

      // Use the passed schedule id, or fall back to current state
      const id = scheduleId || weeklyScheduleId;

      // If a weekly schedule exists, load the station values for that week
      if (id) {
        const { data: valuesData } = await supabase
          .from("station_values")
          .select("*")
          .eq("weekly_schedule_id", id);

        if (valuesData) {
          // Convert the array from Supabase into a nested object
          // This makes it easy to access values by date and station id
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

  // Tracks whether the add-station request is currently saving
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stores which station is currently showing the delete confirmation buttons
  const [confirmingDeleteStationId, setConfirmingDeleteStationId] = useState<
    string | null
  >(null);

  // Deletes a station and also deletes all station_values rows connected to it
  const handleDeleteStation = async (stationId: string) => {
    // First delete related station values so there are no orphaned values
    await supabase.from("station_values").delete().eq("station_id", stationId);

    // Then delete the actual station row
    const { error } = await supabase
      .from("stations")
      .delete()
      .eq("id", stationId);

    if (error) {
      console.error("Error deleting station:", error);
      window.alert(`Failed to delete station: ${error.message}`);
      return;
    }

    // Remove the station from the UI immediately
    setStations((prev) => prev.filter((s) => s.id !== stationId));

    // Remove deleted station values from local state
    setStationValues((prev) => {
      const next = { ...prev };

      Object.keys(next).forEach((date) => {
        const day = { ...next[date] };
        delete day[stationId];
        next[date] = day;
      });

      return next;
    });

    // Exit delete confirmation mode
    setConfirmingDeleteStationId(null);
  };

  // Adds a new station to the stations table
  const handleAddStation = async () => {
    // Do nothing if the input is empty or already submitting
    if (!newStationName.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Insert the new station into Supabase
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

      // Refresh station list after adding
      await fetchStations(weeklyScheduleId || undefined);

      // Close popup and clear input
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

  // Updates a station value for a specific station and date
  const updateStationValue = async (
    date: string,
    stationId: string,
    value: string,
  ) => {
    let currentScheduleId = weeklyScheduleId;

    // If there is no weekly schedule yet, create one first
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

    // Remove anything that is not a number
    const cleanValue = value.replace(/\D/g, "");

    // Convert the typed value into a number, or null if input is empty
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    // Update local UI state immediately
    setStationValues((prev) => ({
      ...prev,
      [date]: { ...prev[date], [stationId]: numValue as any },
    }));

    // Save station value to Supabase
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

  // Loads the Okami and DA Count values from daily_requirements
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
      // Convert array of rows into an object organized by work_date
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

  // Updates either Okami or DA Count for a specific date
  const updateRequirement = async (
    date: string,
    field: "okami_min_drivers_needed" | "da_count",
    value: string,
  ) => {
    let currentScheduleId = weeklyScheduleId;

    // If there is no schedule id yet, create/find one first
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

    // Only allow numbers in the input
    const cleanValue = value.replace(/\D/g, "");

    // Convert input into a number, or null if empty
    const numValue = cleanValue === "" ? null : parseInt(cleanValue, 10);

    // Update local state so the UI changes immediately
    setRequirements((prev) => ({
      ...prev,
      [date]: { ...prev[date], [field]: numValue as any },
    }));

    // Save the changed requirement to Supabase
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

  // Converts day names like "sun" into "Sun"
  const getDayAbbreviation = (day: DayOfWeek) =>
    day.charAt(0).toUpperCase() + day.slice(1);

  // Gets all drivers who are working on a specific day index
  // dayIndex 0 = Sunday, 1 = Monday, etc.
  const getDriversByDay = (dayIndex: number) => {
    const days: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayKey = days[dayIndex];

    return drivers.filter((d) => d[dayKey]);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Top page header with title, add-station button, and week controls */}
      <header className="flex justify-between items-center mb-16">
        <div className="flex items-center gap-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-black">
            Master Schedule
          </h1>

          {/* Opens the add-station modal */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            + Add Station
          </button>
        </div>

        {/* Week navigation controls */}
        <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          {/* Go to previous week */}
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="p-2 hover:bg-gray-50 rounded-lg transition-all cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Display current week range */}
          <span className="font-bold px-4 min-w-[220px] text-center text-sm tracking-tight">
            {format(weekStart, "MMMM d")} —{" "}
            {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </span>

          {/* Go to next week */}
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
          {/* Empty top-left cell */}
          <div className="border-r border-b border-gray-100 flex items-center justify-center">
            <span className="text-[10px] font-black text-gray-300">#</span>
          </div>

          {/* Render each date column header */}
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

        {/* Okami row where user enters minimum drivers needed per day */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/20">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              Okami
            </span>
          </div>

          {/* One Okami input for each day */}
          {weekDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");

            return (
              <div
                key={i}
                className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center group/okami"
              >
                <div className="relative w-full flex items-center justify-center">
                  {/* Placeholder-like label when the value is empty */}
                  {!requirements[dateStr]?.okami_min_drivers_needed && (
                    <span className="absolute text-[10px] text-gray-300 font-medium pointer-events-none uppercase tracking-tighter">
                      okami
                    </span>
                  )}

                  {/* Input for Okami minimum drivers needed */}
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

        {/* DA Count row calculated from how many drivers work each day */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-blue-50/10">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              DA Count
            </span>
          </div>

          {/* Display number of drivers scheduled for each day */}
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

        {/* Dynamic station rows */}
        {stations.map((station) => (
          <div
            key={station.id}
            className="grid grid-cols-[120px_repeat(7,1fr)] bg-gray-50/5"
          >
            {/* Left station name cell */}
            <div className="border-r border-b border-gray-100 flex items-center px-4 group/label bg-gray-50/10 transition-colors">
              {/* If deleting, show Delete and Cancel buttons */}
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
                // Normal station label with trash button
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest truncate">
                    {station.name}
                  </span>

                  {/* Trash button appears when hovering over station label */}
                  <button
                    onClick={() => setConfirmingDeleteStationId(station.id)}
                    className="opacity-0 group-hover/label:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* Render one input cell per day for this station */}
            {weekDays.map((day, i) => {
              const dateStr = format(day, "yyyy-MM-dd");

              // Get saved value for this date and station
              const value = stationValues[dateStr]?.[station.id] ?? "";

              return (
                <div
                  key={i}
                  className="border-r border-b border-gray-100 px-2 py-1 flex items-center justify-center group/st"
                >
                  <div className="relative w-full flex items-center justify-center">
                    {/* Light placeholder showing the station name when empty */}
                    {!value && (
                      <span className="absolute text-[10px] text-gray-200 font-bold uppercase tracking-tighter transition-opacity group-hover/st:opacity-40">
                        {station.name}
                      </span>
                    )}

                    {/* Input for this station's value on this date */}
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

        {/* Capacity row calculated as DA Count minus Okami */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] bg-green-50/20">
          <div className="border-r border-b border-gray-100 flex items-center px-4">
            <span className="text-[10px] font-black text-black uppercase tracking-widest">
              Capacity
            </span>
          </div>

          {/* Calculate capacity for each day */}
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

        {/* Schedule body with 24 rows for driver names */}
        {[...Array(24)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[120px_repeat(7,1fr)] group"
          >
            {/* Left row number cell */}
            <div className="border-r border-b border-gray-50 bg-gray-50/30 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <span className="text-[10px] font-bold text-gray-400 font-mono">
                {String(rowIndex + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Day cells for this row */}
            {weekDays.map((_, dayIndex) => {
              const dayDrivers = getDriversByDay(dayIndex);

              // Gets the driver at this row for this day
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
                    // Display driver name and van number
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
                    // Empty cell if there is no driver in this row
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

            {/* Station name input */}
            <input
              autoFocus
              type="text"
              placeholder="Station name"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-black focus:ring-0 transition-all text-sm font-medium mb-4"
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStation()}
            />

            {/* Modal buttons */}
            <div className="flex gap-2">
              {/* Close modal without saving */}
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>

              {/* Save new station */}
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
