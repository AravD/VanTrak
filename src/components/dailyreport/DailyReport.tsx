import { useState, useEffect, useRef } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { RollCallRow, RollCallDriver, OperationsRow, DailyIssue, DailyAlert } from '../../types/driver';
import { RollCallTable } from './RollCallTable';
import { OperationsTable } from './OperationsTable';
import { RescuesTab } from './RescuesTab';
import { IssuesTab } from './IssuesTab';
import { AlertsTab } from './AlertsTab';
import { PageHeader } from '../common/PageHeader';

const SUB_TABS = ['Roll Call', 'Operations', 'Rescues', 'Issues', 'Alerts'] as const;
type SubTab = (typeof SUB_TABS)[number];

interface Station {
  id: string;
  name: string;
  is_default: boolean;
}

const trimTime = (t: string | null | undefined): string =>
  t ? t.slice(0, 5) : '';

export function DailyReport({ initialDate }: { initialDate?: string }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Roll Call');
  const [selectedDate, setSelectedDate] = useState(
    initialDate ?? format(new Date(), 'yyyy-MM-dd'),
  );
  const [stations, setStations] = useState<Station[]>([]);
  const [activeStationId, setActiveStationId] = useState<string>('');

  // Roll Call state
  const [rollCallRows, setRollCallRows] = useState<RollCallRow[]>([]);
  const [rollCallDrivers, setRollCallDrivers] = useState<RollCallDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Operations state
  const [operationsRows, setOperationsRows] = useState<OperationsRow[]>([]);
  const [opsSaving, setOpsSaving] = useState(false);
  const [opsSaveStatus, setOpsSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Issues state (loaded per day, shared with the Issues tab + the day's export)
  const [dailyIssues, setDailyIssues] = useState<DailyIssue[]>([]);

  // Alerts state — auto-derived (read-only) from the daily_alerts DB view
  const [dailyAlerts, setDailyAlerts] = useState<DailyAlert[]>([]);

  // Track the visible date so an async alert refresh can't overwrite the view
  // after the user has navigated to another day.
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  useEffect(() => {
    loadData(selectedDate);
    loadIssues(selectedDate);
    loadAlerts(selectedDate);
  }, [selectedDate]);

  const loadIssues = async (date: string) => {
    const { data, error } = await supabase
      .from('daily_issues')
      .select('*')
      .eq('issue_date', date)
      .order('created_at', { ascending: true });
    if (!error && data) setDailyIssues(data as DailyIssue[]);
  };

  const loadAlerts = async (date: string) => {
    const { data, error } = await supabase
      .from('daily_alerts')
      .select('*')
      .eq('report_date', date);
    if (!error && data && selectedDateRef.current === date) setDailyAlerts(data as DailyAlert[]);
  };

  const loadData = async (date: string) => {
    setLoading(true);
    setSaveStatus('idle');
    setOpsSaveStatus('idle');

    const { data: schedules, error: schedError } = await supabase
      .from('weekly_schedules')
      .select('id')
      .lte('week_start_date', date)
      .gte('week_end_date', date)
      .limit(1);

    if (schedError) {
      console.error('Error finding weekly schedule:', schedError);
      setRollCallRows([]);
      setRollCallDrivers([]);
      setOperationsRows([]);
      setLoading(false);
      return;
    }

    const scheduleId = schedules?.[0]?.id ?? null;

    if (!scheduleId) {
      setStations([]);
      setActiveStationId('');
      setRollCallRows([]);
      setRollCallDrivers([]);
      setOperationsRows([]);
      setLoading(false);
      return;
    }

    const { data: stationsData } = await supabase
      .from('stations')
      .select('id, name, is_default')
      .or(`is_default.eq.true,created_for_week_id.eq.${scheduleId}`);

    if (stationsData) {
      const sorted = [...stationsData].sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setStations(sorted);
      setActiveStationId((prev) => {
        if (prev && sorted.some((s) => s.id === prev)) return prev;
        return sorted[0]?.id ?? '';
      });
    }

    const [{ data: assignments, error: assignError }, { data: existingRollCall }] =
      await Promise.all([
        supabase
          .from('schedule_assignments')
          .select('id, driver_id, station_id, drivers(first_name, last_name, notes)')
          .eq('weekly_schedule_id', scheduleId)
          .eq('work_date', date)
          .eq('assignment_status', 'Scheduled'),
        supabase.from('daily_roll_call').select('*').eq('report_date', date),
      ]);

    if (assignError) {
      console.error('Error fetching assignments:', assignError);
      setLoading(false);
      return;
    }

    const existingMap = new Map<string, any>();
    (existingRollCall || []).forEach((row) => existingMap.set(row.driver_id, row));

    const drivers: RollCallDriver[] = [];
    const rcRows: RollCallRow[] = [];
    const opsRows: OperationsRow[] = [];

    (assignments || []).forEach((assignment: any) => {
      const d = Array.isArray(assignment.drivers) ? assignment.drivers[0] : assignment.drivers;
      if (!d) return;

      drivers.push({
        driver_id: assignment.driver_id,
        first_name: d.first_name,
        last_name: d.last_name,
        notes: d.notes ?? null,
        schedule_assignment_id: assignment.id,
        station_id: assignment.station_id ?? null,
      });

      const ex = existingMap.get(assignment.driver_id);

      rcRows.push({
        id: ex?.id,
        report_date: date,
        station_id: assignment.station_id ?? null,
        driver_id: assignment.driver_id,
        schedule_assignment_id: assignment.id,
        route_number: ex?.route_number ?? '',
        role: ex?.role ?? 'Driver',
        dvic_status: ex?.dvic_status ?? 'Not Completed',
        attendance_status: ex?.attendance_status ?? '',
        arrival_time: trimTime(ex?.arrival_time),
        van_number: ex?.van_number ?? '',
        phone_assignment: ex?.phone_assignment ?? '',
      });

      opsRows.push({
        id: ex?.id,
        report_date: date,
        station_id: assignment.station_id ?? null,
        driver_id: assignment.driver_id,
        schedule_assignment_id: assignment.id,
        route_number: ex?.route_number ?? '',
        stops_count: ex?.stops_count?.toString() ?? '',
        packages_count: ex?.packages_count?.toString() ?? '',
        route_status: ex?.route_status ?? 'Not Started',
        rts_number: ex?.rts_number ?? '',
        last_delivery_time: trimTime(ex?.last_delivery_time),
        rescue_notes: ex?.rescue_notes ?? '',
        paycom_logout_time: trimTime(ex?.paycom_logout_time),
        total_hours_worked: ex?.total_hours_worked?.toString() ?? '',
        closeout_notes: ex?.end_of_day_notes ?? '',
      });
    });

    const sortedDrivers = [...drivers].sort((a, b) => {
      const first = a.first_name.localeCompare(b.first_name);
      return first !== 0 ? first : a.last_name.localeCompare(b.last_name);
    });

    const rcById = new Map(rcRows.map((r) => [r.driver_id, r]));
    const opsById = new Map(opsRows.map((r) => [r.driver_id, r]));

    setRollCallDrivers(sortedDrivers);
    setRollCallRows(sortedDrivers.map((d) => rcById.get(d.driver_id)!).filter(Boolean));
    setOperationsRows(sortedDrivers.map((d) => opsById.get(d.driver_id)!).filter(Boolean));
    setLoading(false);
  };

  // ── Autosave plumbing ──────────────────────────────────────────────────────
  // Roll Call + Operations write to the same daily_roll_call row (keyed by
  // report_date + driver_id); each upsert only sends its own columns, so they
  // never clobber each other. Refs hold the latest rows so a debounced save
  // always flushes current values without re-loading (which would steal focus).
  const rollCallRowsRef = useRef(rollCallRows);
  const operationsRowsRef = useRef(operationsRows);
  useEffect(() => { rollCallRowsRef.current = rollCallRows; }, [rollCallRows]);
  useEffect(() => { operationsRowsRef.current = operationsRows; }, [operationsRows]);

  const rcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosaveRollCall = async () => {
    const rows = rollCallRowsRef.current;
    if (rows.length === 0) return;
    setSaving(true);
    setSaveStatus('idle');
    const now = new Date().toISOString();
    const records = rows.map((row) => ({
      report_date: row.report_date,
      station_id: row.station_id ?? null,
      driver_id: row.driver_id,
      schedule_assignment_id: row.schedule_assignment_id ?? null,
      route_number: row.route_number || null,
      role: row.role,
      dvic_status: row.dvic_status,
      attendance_status: row.attendance_status,
      arrival_time: row.arrival_time || null,
      van_number: row.van_number || null,
      phone_assignment: row.phone_assignment || null,
      updated_at: now,
    }));
    const { error } = await supabase
      .from('daily_roll_call')
      .upsert(records, { onConflict: 'report_date,driver_id' });
    setSaving(false);
    setSaveStatus(error ? 'error' : 'success');
    if (error) console.error('Error autosaving roll call:', error);
    // Attendance drives alerts (No Show / Late) — refresh them live.
    else void loadAlerts(rows[0].report_date);
  };

  const autosaveOperations = async () => {
    const rows = operationsRowsRef.current;
    if (rows.length === 0) return;
    const date = rows[0].report_date;
    setOpsSaving(true);
    setOpsSaveStatus('idle');
    const now = new Date().toISOString();
    // route_number is owned by Roll Call — intentionally omitted so Operations
    // never overwrites a route entered on the Roll Call tab.
    const records = rows.map((row) => ({
      report_date: row.report_date,
      station_id: row.station_id ?? null,
      driver_id: row.driver_id,
      schedule_assignment_id: row.schedule_assignment_id ?? null,
      stops_count: row.stops_count ? parseInt(row.stops_count, 10) : null,
      packages_count: row.packages_count ? parseInt(row.packages_count, 10) : null,
      route_status: row.route_status,
      rts_number: row.rts_number || null,
      last_delivery_time: row.last_delivery_time || null,
      rescue_notes: row.rescue_notes || null,
      paycom_logout_time: row.paycom_logout_time || null,
      // total_hours_worked is computed by the database trigger — never written from the client
      end_of_day_notes: row.closeout_notes || null,
      updated_at: now,
    }));
    const { error } = await supabase
      .from('daily_roll_call')
      .upsert(records, { onConflict: 'report_date,driver_id' });
    if (error) {
      console.error('Error autosaving operations:', error);
      setOpsSaveStatus('error');
      setOpsSaving(false);
      return;
    }
    setOpsSaveStatus('success');
    setOpsSaving(false);
    // Route status / hours / delivery times drive alerts — refresh them live.
    void loadAlerts(date);
    // Refresh the DB-computed Total Hours without disturbing inputs still being
    // edited (merge only rows for the same date + driver).
    const { data } = await supabase
      .from('daily_roll_call')
      .select('driver_id, total_hours_worked')
      .eq('report_date', date);
    if (data) {
      const byDriver = new Map(data.map((r: any) => [r.driver_id, r.total_hours_worked]));
      setOperationsRows((prev) =>
        prev.map((r) =>
          r.report_date === date && byDriver.has(r.driver_id)
            ? { ...r, total_hours_worked: byDriver.get(r.driver_id)?.toString() ?? '' }
            : r,
        ),
      );
    }
  };

  // Immediately flush any pending debounced save (on date change / unmount).
  const flushPending = () => {
    if (rcTimer.current) { clearTimeout(rcTimer.current); rcTimer.current = null; void autosaveRollCall(); }
    if (opsTimer.current) { clearTimeout(opsTimer.current); opsTimer.current = null; void autosaveOperations(); }
  };
  useEffect(() => {
    return () => { flushPending(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ── Roll Call handlers ─────────────────────────────────────────────────────

  const handleRollCallChange = (driverId: string, field: keyof RollCallRow, value: string) => {
    setRollCallRows((prev) =>
      prev.map((row) => {
        if (row.driver_id !== driverId) return row;
        const updated = { ...row, [field]: value };
        if (field === 'attendance_status' && value === 'No Show') updated.arrival_time = '';
        return updated;
      }),
    );
    if (rcTimer.current) clearTimeout(rcTimer.current);
    rcTimer.current = setTimeout(() => { void autosaveRollCall(); }, 600);
  };

  // ── Operations handlers ────────────────────────────────────────────────────

  const handleOperationsChange = (
    driverId: string,
    field: keyof OperationsRow,
    value: string,
  ) => {
    setOperationsRows((prev) =>
      prev.map((row) => (row.driver_id === driverId ? { ...row, [field]: value } : row)),
    );
    if (opsTimer.current) clearTimeout(opsTimer.current);
    opsTimer.current = setTimeout(() => { void autosaveOperations(); }, 600);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const defaultStation = stations.find((s) => s.is_default);

  const rowsForStation = (stationId: string) =>
    rollCallRows.filter(
      (row) =>
        row.station_id === stationId ||
        (row.station_id === null && defaultStation?.id === stationId),
    );

  const driversForStation = (stationId: string) =>
    rollCallDrivers.filter(
      (d) =>
        d.station_id === stationId ||
        (d.station_id === null && defaultStation?.id === stationId),
    );

  const filteredRows = activeStationId ? rowsForStation(activeStationId) : rollCallRows;
  const filteredDrivers = activeStationId ? driversForStation(activeStationId) : rollCallDrivers;

  const filteredDriverIds = new Set(filteredDrivers.map((d) => d.driver_id));
  const filteredOpsRows = operationsRows.filter((r) => filteredDriverIds.has(r.driver_id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Daily Report" className="mb-8">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'))}
            aria-label="Previous day"
            className="group p-2 hover:bg-gray-100 rounded-lg transition-[transform,background-color] duration-150 ease-out cursor-pointer active:scale-90"
          >
            <ChevronLeft size={18} className="transition-transform duration-150 ease-out group-hover:-translate-x-0.5" />
          </button>
          <span className="font-bold px-2 min-w-[210px] text-center text-sm tracking-tight tabular-nums">
            {format(parseISO(selectedDate), 'EEE, MMMM d, yyyy')}
          </span>
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            aria-label="Next day"
            className="group p-2 hover:bg-gray-100 rounded-lg transition-[transform,background-color] duration-150 ease-out cursor-pointer active:scale-90"
          >
            <ChevronRight size={18} className="transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          </button>
        </div>
      </PageHeader>

      {/* Station tabs — skeleton on first load so the row doesn't pop in */}
      {loading && stations.length === 0 && (
        <div className="flex gap-2 mb-6">
          {[96, 116, 80].map((w, i) => (
            <div
              key={i}
              className="h-[42px] rounded-xl bg-gray-100 animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>
      )}
      {stations.length > 0 && (
        <div className="flex gap-2 mb-6">
          {stations.map((station) => {
            const count = rowsForStation(station.id).length;
            const isActive = activeStationId === station.id;
            return (
              <button
                key={station.id}
                onClick={() => setActiveStationId(station.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
                  isActive
                    ? 'bg-black text-white shadow-md shadow-black/10'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {station.name}
                <span
                  className={cn(
                    'text-[11px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px',
              activeSubTab === tab
                ? 'border-black text-black'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            )}
          >
            {tab === 'Alerts' ? (
              <span className="inline-flex items-center gap-1.5">
                Alerts
                {dailyAlerts.length > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums transition-colors',
                      activeSubTab === 'Alerts'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-600',
                    )}
                  >
                    {dailyAlerts.length}
                  </span>
                )}
              </span>
            ) : (
              tab
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeSubTab === 'Roll Call' && (
        <RollCallTable
          rows={filteredRows}
          drivers={filteredDrivers}
          loading={loading}
          saving={saving}
          saveStatus={saveStatus}
          onRowChange={handleRollCallChange}
        />
      )}

      {activeSubTab === 'Operations' && (
        <OperationsTable
          rows={filteredOpsRows}
          drivers={filteredDrivers}
          loading={loading}
          saving={opsSaving}
          saveStatus={opsSaveStatus}
          onRowChange={handleOperationsChange}
        />
      )}

      {activeSubTab === 'Rescues' && (
        <RescuesTab selectedDate={selectedDate} drivers={rollCallDrivers} stationId={activeStationId} />
      )}

      {activeSubTab === 'Issues' && (
        <IssuesTab
          selectedDate={selectedDate}
          activeStationId={activeStationId}
          drivers={filteredDrivers}
          issues={dailyIssues}
          onChanged={() => loadIssues(selectedDate)}
        />
      )}

      {activeSubTab === 'Alerts' && (
        <AlertsTab
          selectedDate={selectedDate}
          alerts={dailyAlerts}
          drivers={rollCallDrivers}
        />
      )}
    </div>
  );
}
