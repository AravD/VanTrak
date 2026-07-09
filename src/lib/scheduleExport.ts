import type { Workbook, Worksheet, Borders } from 'exceljs';
import { parseISO, addDays, startOfWeek, format } from 'date-fns';
import { supabase } from './supabase';

/**
 * Styled Master Schedule export — reproduces the on-screen week grid (one sheet
 * per week): a day header, then per station the Okami / <station> / DA Count /
 * Capacity rows, then the numbered driver lists, with the same colour cues
 * (blue metrics, green capacity, pink = new hire, red = over-scheduled).
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * COLOUR SEAM — colours are OFF for now. The export renders a plain grid
 * (layout + borders + bold headers, all text black, no fills).
 *
 * The full styling engine (exceljs) is already wired; only the colour *values*
 * are suppressed by this flag. To turn colour on later:
 *   1) flip COLORS_ON = true  → the metric/header fills + status text colours
 *      defined in `C` and passed to `set(...)` light up immediately.
 *   2) to drive colours from your own colour functionality (e.g. per-cell
 *      colours stored in the DB), pass them into the `set(..., { fill, color })`
 *      calls in buildWeekSheet — the machinery already applies whatever it's given.
 */
const COLORS_ON = false;

const C = {
  headerFill: 'FFBDD7EE',
  dateFill: 'FFDDEBF7',
  metricBlueFill: 'FFDDEBF7',
  metricGreenFill: 'FFE2EFDA',
  scheduledFill: 'FFE4DFEC',
  labelFill: 'FFF2F2F2',
  blueText: 'FF1F4E79',
  greenText: 'FF375623',
  pinkText: 'FFB5007A',
  redText: 'FFC00000',
  border: 'FFD9D9D9',
};
const thin = { style: 'thin' as const, color: { argb: C.border } };
const ALL_BORDERS: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

interface DriverCell {
  driver_id: string;
  first_name: string;
  last_name: string;
  status: string | null;
  notes: string | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const key = (a: string, b: string, c: string) => `${a}|${b}|${c}`;

// ── Public API ────────────────────────────────────────────────────────────────
export async function exportMasterScheduleStyled(start: string, end: string): Promise<number> {
  // Sunday-aligned weeks spanning the range (matches the schedule page).
  const weekStarts: Date[] = [];
  for (let cur = startOfWeek(parseISO(start)); cur <= parseISO(end); cur = addDays(cur, 7)) {
    weekStarts.push(cur);
  }
  const weekStartStrs = weekStarts.map((d) => format(d, 'yyyy-MM-dd'));

  const { data: weekRows } = await supabase
    .from('weekly_schedules')
    .select('id, week_start_date')
    .in('week_start_date', weekStartStrs);
  const wsIdByStart = new Map<string, string>((weekRows ?? []).map((w: any) => [w.week_start_date, w.id]));
  const wsIds = (weekRows ?? []).map((w: any) => w.id);

  const [{ data: stationsData }, { data: assignmentsData }, { data: reqData }, { data: valData }] =
    await Promise.all([
      supabase.from('stations').select('id, name, is_default, created_for_week_id'),
      wsIds.length
        ? supabase
            .from('schedule_assignments')
            .select('weekly_schedule_id, work_date, station_id, driver_id, drivers:driver_id ( first_name, last_name, status, notes )')
            .in('weekly_schedule_id', wsIds)
            .eq('assignment_status', 'Scheduled')
        : Promise.resolve({ data: [] as any[] }),
      wsIds.length
        ? supabase
            .from('station_requirements')
            .select('weekly_schedule_id, station_id, work_date, okami, da_count, capacity')
            .in('weekly_schedule_id', wsIds)
        : Promise.resolve({ data: [] as any[] }),
      wsIds.length
        ? supabase
            .from('station_values')
            .select('weekly_schedule_id, station_id, work_date, value')
            .in('weekly_schedule_id', wsIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const stations = (stationsData ?? []) as {
    id: string; name: string; is_default: boolean; created_for_week_id: string | null;
  }[];

  // Lookups keyed by weeklyScheduleId|stationId|workDate.
  const okamiMap = new Map<string, number | null>();
  const daMap = new Map<string, number | null>();
  const capMap = new Map<string, number | null>();
  for (const r of reqData ?? []) {
    okamiMap.set(key(r.weekly_schedule_id, r.station_id, r.work_date), r.okami);
    daMap.set(key(r.weekly_schedule_id, r.station_id, r.work_date), r.da_count);
    capMap.set(key(r.weekly_schedule_id, r.station_id, r.work_date), r.capacity);
  }
  const valMap = new Map<string, number | null>();
  for (const v of valData ?? []) valMap.set(key(v.weekly_schedule_id, v.station_id, v.work_date), v.value);

  const asgMap = new Map<string, DriverCell[]>();
  const weekDriverDays = new Map<string, Set<string>>(); // `${wsId}|${driverId}` -> dates
  for (const a of assignmentsData ?? []) {
    const d = one(a.drivers as DriverCell | DriverCell[] | null);
    if (!d) continue;
    const k = key(a.weekly_schedule_id, a.station_id, a.work_date);
    const arr = asgMap.get(k) ?? [];
    arr.push({ driver_id: a.driver_id, first_name: d.first_name, last_name: d.last_name, status: d.status, notes: d.notes });
    asgMap.set(k, arr);
    const wk = `${a.weekly_schedule_id}|${a.driver_id}`;
    const set = weekDriverDays.get(wk) ?? new Set<string>();
    set.add(a.work_date);
    weekDriverDays.set(wk, set);
  }

  // Lazy-load exceljs so it's a separate chunk fetched only when exporting.
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default?.Workbook ? mod.default : mod;
  const wb: Workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  for (const weekStart of weekStarts) {
    const wsId = wsIdByStart.get(format(weekStart, 'yyyy-MM-dd')) ?? null;
    const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
    const weekStations = stations
      .filter((s) => s.is_default || (wsId && s.created_for_week_id === wsId))
      .sort((a, b) => (a.is_default !== b.is_default ? (a.is_default ? -1 : 1) : a.name.localeCompare(b.name)));

    let name = `Week of ${format(weekStart, 'MMM d')}`;
    let n = 2;
    while (usedNames.has(name.toLowerCase())) name = `Week of ${format(weekStart, 'MMM d')} (${n++})`;
    usedNames.add(name.toLowerCase());

    buildWeekSheet(wb.addWorksheet(name), {
      days,
      wsId,
      stations: weekStations,
      okamiMap, daMap, capMap, valMap, asgMap, weekDriverDays,
    });
  }

  await triggerDownload(wb, `Master Schedule ${start} to ${end}.xlsx`);
  return (assignmentsData ?? []).length;
}

// ── Sheet builder ──────────────────────────────────────────────────────────────
interface WeekCtx {
  days: Date[];
  wsId: string | null;
  stations: { id: string; name: string; is_default: boolean; created_for_week_id: string | null }[];
  okamiMap: Map<string, number | null>;
  daMap: Map<string, number | null>;
  capMap: Map<string, number | null>;
  valMap: Map<string, number | null>;
  asgMap: Map<string, DriverCell[]>;
  weekDriverDays: Map<string, Set<string>>;
}

function buildWeekSheet(ws: Worksheet, ctx: WeekCtx) {
  const { days, wsId, stations } = ctx;
  ws.columns = [{ width: 16 }, ...Array(7).fill({ width: 18 })];
  let r = 1;

  const set = (
    row: number, col: number, value: string | number | null,
    opts: { fill?: string; color?: string; bold?: boolean; align?: 'left' | 'center' } = {},
  ) => {
    const cell = ws.getRow(row).getCell(col);
    cell.value = value === null || value === undefined || value === '' ? null : value;
    // Colour values are gated behind COLORS_ON; layout/borders/bold always apply.
    if (COLORS_ON && opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    cell.font = {
      bold: opts.bold ?? false,
      color: { argb: COLORS_ON ? opts.color ?? 'FF000000' : 'FF000000' },
      size: 11,
    };
    cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'center' };
    cell.border = ALL_BORDERS;
  };

  const metricRow = (label: string, values: (number | string | null)[], fill: string, color: string) => {
    set(r, 1, label, { fill: C.labelFill, bold: true, align: 'left' });
    values.forEach((v, i) => set(r, i + 2, v ?? null, { fill, color, bold: true }));
    r++;
  };

  // Header: Week + day names, then Date row.
  set(r, 1, 'Week', { fill: C.headerFill, bold: true, align: 'left' });
  days.forEach((d, i) => set(r, i + 2, DAY_NAMES[i], { fill: C.headerFill, bold: true }));
  r++;
  set(r, 1, 'Date', { fill: C.dateFill, bold: true, align: 'left' });
  days.forEach((d, i) => set(r, i + 2, format(d, 'M/d'), { fill: C.dateFill, bold: true }));
  r++;

  for (const station of stations) {
    const at = (map: Map<string, number | null>, d: Date) =>
      wsId ? map.get(key(wsId, station.id, format(d, 'yyyy-MM-dd'))) ?? null : null;

    metricRow('Okami', days.map((d) => at(ctx.okamiMap, d)), C.metricBlueFill, C.blueText);
    metricRow(station.name, days.map((d) => at(ctx.valMap, d)), C.metricBlueFill, 'FF000000');
    metricRow('DA Count', days.map((d) => at(ctx.daMap, d)), C.metricBlueFill, C.blueText);
    metricRow('Capacity', days.map((d) => at(ctx.capMap, d)), C.metricGreenFill, C.greenText);
    metricRow('Completed', Array(7).fill(null), C.metricGreenFill, C.greenText);
    metricRow('Cap/Rel %', Array(7).fill(null), C.metricGreenFill, C.greenText);

    // "Scheduled" sub-header.
    set(r, 1, null, { fill: C.scheduledFill });
    days.forEach((_, i) => set(r, i + 2, 'Scheduled', { fill: C.scheduledFill, bold: true, color: C.blueText }));
    r++;

    // Driver rows: as many as the busiest day, min 5.
    const perDay = days.map((d) =>
      wsId ? (ctx.asgMap.get(key(wsId, station.id, format(d, 'yyyy-MM-dd'))) ?? []) : []
    );
    perDay.forEach((list) => list.sort((a, b) => a.last_name.localeCompare(b.last_name)));
    const rowCount = Math.max(5, ...perDay.map((l) => l.length));

    for (let i = 0; i < rowCount; i++) {
      set(r, 1, String(i + 1).padStart(2, '0'), { fill: C.labelFill, color: 'FF808080' });
      days.forEach((d, di) => {
        const drv = perDay[di][i];
        if (!drv) {
          set(r, di + 2, null);
          return;
        }
        const overscheduled = wsId
          ? (ctx.weekDriverDays.get(`${wsId}|${drv.driver_id}`)?.size ?? 0) > 5
          : false;
        const newHire = (drv.notes ?? '').toLowerCase().includes('new hire');
        const color = overscheduled ? C.redText : newHire ? C.pinkText : 'FF000000';
        set(r, di + 2, `${drv.first_name} ${drv.last_name}`, { color, align: 'left' });
      });
      r++;
    }

    r++; // gap between stations
  }
}

async function triggerDownload(wb: Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  URL.revokeObjectURL(url);
}
