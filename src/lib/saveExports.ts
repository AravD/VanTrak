import { supabase } from './supabase';
import { downloadWorkbook, tableSheet } from './export';

/**
 * Date-range exports for the Save Information page.
 *
 * Each section pulls its own slice of data from Supabase, downloads a workbook,
 * and reports how many rows were written. The Save Information page then logs
 * the export (see `logExport`) so the 30-day retention job knows what to purge.
 */

export type ExportSection =
  | 'master_schedule'
  | 'daily_report'
  | 'time_off'
  | 'driver_contacts';

const trimTime = (t: string | null | undefined): string => (t ? t.slice(0, 5) : '');

/** Shared id → display-name lookups so exports show names, not UUIDs. */
async function nameMaps() {
  const [{ data: drivers }, { data: stations }] = await Promise.all([
    supabase.from('drivers').select('id, first_name, last_name'),
    supabase.from('stations').select('id, name, is_default'),
  ]);

  const driverName = new Map<string, string>(
    (drivers ?? []).map((d: any) => [d.id, `${d.first_name} ${d.last_name}`]),
  );
  const defaultStation = (stations ?? []).find((s: any) => s.is_default);
  const stationName = (id: string | null | undefined): string => {
    if (!id) return defaultStation?.name ?? '';
    return (stations ?? []).find((s: any) => s.id === id)?.name ?? '';
  };

  return { driverName, stationName };
}

// ── Master Schedule ──────────────────────────────────────────────────────────
export async function exportMasterSchedule(start: string, end: string): Promise<number> {
  const { driverName, stationName } = await nameMaps();
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select('work_date, station_id, driver_id, role_assignment, assignment_status, shift_start, shift_end, notes')
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  downloadWorkbook(`Master Schedule ${start} to ${end}`, [
    tableSheet(
      'Assignments',
      [
        { header: 'Date', value: (r: any) => r.work_date, width: 14 },
        { header: 'Station', value: (r: any) => stationName(r.station_id), width: 18 },
        { header: 'Driver', value: (r: any) => driverName.get(r.driver_id) ?? '', width: 22 },
        { header: 'Role', value: (r: any) => r.role_assignment, width: 14 },
        { header: 'Status', value: (r: any) => r.assignment_status, width: 14 },
        { header: 'Shift Start', value: (r: any) => trimTime(r.shift_start), width: 12 },
        { header: 'Shift End', value: (r: any) => trimTime(r.shift_end), width: 12 },
        { header: 'Notes', value: (r: any) => r.notes, width: 40 },
      ],
      rows,
    ),
  ]);

  return rows.length;
}

// ── Daily Report ─────────────────────────────────────────────────────────────
export async function exportDailyReport(start: string, end: string): Promise<number> {
  const { driverName, stationName } = await nameMaps();
  const [{ data: rollCall, error: rcErr }, { data: issues, error: issuesErr }] = await Promise.all([
    supabase
      .from('daily_roll_call')
      .select('*')
      .gte('report_date', start)
      .lte('report_date', end)
      .order('report_date', { ascending: true }),
    supabase
      .from('daily_issues')
      .select('*')
      .gte('issue_date', start)
      .lte('issue_date', end)
      .order('issue_date', { ascending: true }),
  ]);
  if (rcErr) throw rcErr;
  if (issuesErr) throw issuesErr;

  const rcRows = rollCall ?? [];
  const issueRows = issues ?? [];

  downloadWorkbook(`Daily Report ${start} to ${end}`, [
    tableSheet(
      'Roll Call',
      [
        { header: 'Date', value: (r: any) => r.report_date, width: 14 },
        { header: 'Driver', value: (r: any) => driverName.get(r.driver_id) ?? '', width: 22 },
        { header: 'Station', value: (r: any) => stationName(r.station_id), width: 16 },
        { header: 'Route #', value: (r: any) => r.route_number },
        { header: 'Role', value: (r: any) => r.role },
        { header: 'Attendance', value: (r: any) => r.attendance_status, width: 16 },
        { header: 'Arrival', value: (r: any) => trimTime(r.arrival_time) },
        { header: 'DVIC', value: (r: any) => r.dvic_status, width: 16 },
        { header: 'Van #', value: (r: any) => r.van_number },
        { header: 'Phone', value: (r: any) => r.phone_assignment, width: 16 },
      ],
      rcRows,
    ),
    tableSheet(
      'Operations',
      [
        { header: 'Date', value: (r: any) => r.report_date, width: 14 },
        { header: 'Driver', value: (r: any) => driverName.get(r.driver_id) ?? '', width: 22 },
        { header: 'Station', value: (r: any) => stationName(r.station_id), width: 16 },
        { header: 'Route #', value: (r: any) => r.route_number },
        { header: 'Stops', value: (r: any) => r.stops_count },
        { header: 'Packages', value: (r: any) => r.packages_count },
        { header: 'Status', value: (r: any) => r.route_status, width: 16 },
        { header: 'RTS #', value: (r: any) => r.rts_number },
        { header: 'Last Delivery', value: (r: any) => trimTime(r.last_delivery_time), width: 14 },
        { header: 'Rescue Notes', value: (r: any) => r.rescue_notes, width: 30 },
        { header: 'Paycom Logout', value: (r: any) => trimTime(r.paycom_logout_time), width: 14 },
        { header: 'Total Hours', value: (r: any) => r.total_hours_worked, width: 12 },
        { header: 'Closeout Notes', value: (r: any) => r.end_of_day_notes, width: 30 },
      ],
      rcRows,
    ),
    tableSheet(
      'Issues',
      [
        { header: 'Date', value: (r: any) => r.issue_date, width: 14 },
        { header: 'Type', value: (r: any) => r.issue_type, width: 18 },
        {
          header: 'Driver',
          value: (r: any) => (r.driver_id ? driverName.get(r.driver_id) ?? '' : 'No Driver / Station'),
          width: 22,
        },
        { header: 'Station', value: (r: any) => stationName(r.station_id), width: 16 },
        { header: 'Notes', value: (r: any) => r.notes, width: 50 },
      ],
      issueRows,
    ),
  ]);

  return rcRows.length + issueRows.length;
}

// ── Time Off & Exceptions ────────────────────────────────────────────────────
export async function exportTimeOff(start: string, end: string): Promise<number> {
  const { driverName } = await nameMaps();
  // Any exception that overlaps the selected window.
  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select('*')
    .lte('start_date', end)
    .gte('end_date', start)
    .order('start_date', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  downloadWorkbook(`Time Off & Exceptions ${start} to ${end}`, [
    tableSheet(
      'Time Off & Exceptions',
      [
        { header: 'Driver', value: (r: any) => driverName.get(r.driver_id) ?? '', width: 22 },
        { header: 'Type', value: (r: any) => r.exception_type, width: 14 },
        { header: 'Start', value: (r: any) => r.start_date, width: 14 },
        { header: 'End', value: (r: any) => r.end_date, width: 14 },
        { header: 'Status', value: (r: any) => r.status, width: 12 },
        { header: 'Removed', value: (r: any) => (r.remove_from_schedule ? 'Yes' : 'No') },
        { header: 'Makeup Req.', value: (r: any) => (r.makeup_required ? 'Yes' : 'No') },
        { header: 'Makeup Start', value: (r: any) => r.makeup_start_date, width: 14 },
        { header: 'Makeup End', value: (r: any) => r.makeup_end_date, width: 14 },
        { header: 'Notes', value: (r: any) => r.notes, width: 40 },
      ],
      rows,
    ),
  ]);

  return rows.length;
}

// ── Driver Contacts (full roster — date range does not apply) ─────────────────
export async function exportDriverContacts(): Promise<number> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('first_name', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  const availability = (r: any) =>
    [
      r.sun && 'Su',
      r.mon && 'Mo',
      r.tue && 'Tu',
      r.wed && 'We',
      r.thu && 'Th',
      r.fri && 'Fr',
      r.sat && 'Sa',
    ]
      .filter(Boolean)
      .join(' ');

  downloadWorkbook('Driver Contacts', [
    tableSheet(
      'Drivers',
      [
        { header: 'First Name', value: (r: any) => r.first_name, width: 16 },
        { header: 'Last Name', value: (r: any) => r.last_name, width: 16 },
        { header: 'Status', value: (r: any) => r.status, width: 12 },
        { header: 'Email', value: (r: any) => r.email, width: 26 },
        { header: 'Phone', value: (r: any) => r.phone, width: 16 },
        { header: 'Van #', value: (r: any) => r.van_number },
        { header: 'Days Worked', value: (r: any) => r.days_worked, width: 12 },
        { header: 'Availability', value: (r: any) => availability(r), width: 20 },
        { header: 'Notes', value: (r: any) => r.notes, width: 40 },
      ],
      rows,
    ),
  ]);

  return rows.length;
}

/**
 * Records an export so the daily retention job can purge its data after 30 days.
 * Returns the ISO `expires_at` timestamp (or null if logging failed).
 */
export async function logExport(
  section: ExportSection,
  rangeStart: string | null,
  rangeEnd: string | null,
  rowCount: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('data_export_log')
    .insert({
      section,
      range_start: rangeStart,
      range_end: rangeEnd,
      row_count: rowCount,
    })
    .select('expires_at')
    .single();

  if (error) {
    console.error('Failed to log data export:', error);
    return null;
  }
  return (data as any)?.expires_at ?? null;
}

export interface ScheduledDeletion {
  id: string;
  section: ExportSection;
  range_start: string | null;
  range_end: string | null;
  row_count: number | null;
  exported_at: string;
  expires_at: string;
}

/** Exports whose data is still scheduled for deletion (not yet purged). */
export async function fetchScheduledDeletions(): Promise<ScheduledDeletion[]> {
  const { data, error } = await supabase
    .from('data_export_log')
    .select('id, section, range_start, range_end, row_count, exported_at, expires_at')
    .is('purged_at', null)
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('Failed to load scheduled deletions:', error);
    return [];
  }
  return (data ?? []) as ScheduledDeletion[];
}

/**
 * Cancels a scheduled deletion so its data stays in the app. Removing the log
 * row means the retention job has nothing to purge for that export.
 */
export async function cancelScheduledDeletion(id: string): Promise<boolean> {
  const { error } = await supabase.from('data_export_log').delete().eq('id', id);
  if (error) {
    console.error('Failed to cancel scheduled deletion:', error);
    return false;
  }
  return true;
}
