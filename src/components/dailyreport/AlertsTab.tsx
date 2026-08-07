import { format, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import { DailyAlert, RollCallDriver } from '../../types/driver';

interface AlertStyle {
  bubble: string;
  dot: string;
  /** Sort rank — lower shows first (most severe at the top). */
  rank: number;
}

// Red is reserved for the long-day tiers; every other alert uses a distinct hue.
const ALERT_STYLES: Record<string, AlertStyle> = {
  long_day_12:   { bubble: 'bg-red-100 border-red-300 text-red-900',         dot: 'bg-red-700',    rank: 0 },
  long_day_10:   { bubble: 'bg-red-50 border-red-200 text-red-800',          dot: 'bg-red-500',    rank: 1 },
  no_show:       { bubble: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-400', rank: 2 },
  route_failed:  { bubble: 'bg-pink-50 border-pink-200 text-pink-800',       dot: 'bg-pink-500',   rank: 3 },
  late:          { bubble: 'bg-yellow-50 border-yellow-200 text-yellow-800', dot: 'bg-yellow-400', rank: 4 },
  late_delivery: { bubble: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-400', rank: 5 },
  slow_clockout: { bubble: 'bg-purple-50 border-purple-200 text-purple-800', dot: 'bg-purple-400', rank: 6 },
  rescue:        { bubble: 'bg-blue-50 border-blue-200 text-blue-800',       dot: 'bg-blue-400',   rank: 7 },
};

const FALLBACK: AlertStyle = { bubble: 'bg-gray-50 border-gray-200 text-gray-700', dot: 'bg-gray-400', rank: 99 };

const styleFor = (type: string): AlertStyle => ALERT_STYLES[type] ?? FALLBACK;

// Each column groups one kind of alert. Ordered most-severe first; within a
// column, tiers are stacked with the worst on top (e.g. Very Long Day above Long Day).
const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Long Days', types: ['long_day_12', 'long_day_10'] },
  { title: 'No Shows', types: ['no_show'] },
  { title: 'Failed Routes', types: ['route_failed'] },
  { title: 'Late Arrivals', types: ['late'] },
  { title: 'Late Last Delivery', types: ['late_delivery'] },
  { title: 'Slow Clock-Outs', types: ['slow_clockout'] },
  { title: 'Rescues', types: ['rescue'] },
];

interface AlertsTabProps {
  selectedDate: string;
  alerts: DailyAlert[];
  drivers: RollCallDriver[];
}

export function AlertsTab({ selectedDate, alerts, drivers }: AlertsTabProps) {
  const driverName = (id: string | null) => {
    if (!id) return null;
    const d = drivers.find((dr) => dr.driver_id === id);
    return d ? `${d.first_name} ${d.last_name}` : null;
  };

  const byRank = (a: DailyAlert, b: DailyAlert) =>
    styleFor(a.alert_type).rank - styleFor(b.alert_type).rank;

  // Build one column per alert type that actually has entries today.
  const columns = GROUPS.map((g) => ({
    title: g.title,
    items: alerts.filter((a) => g.types.includes(a.alert_type)).sort(byRank),
  })).filter((c) => c.items.length > 0);

  // Sweep up any unrecognised alert types into a trailing "Other" column.
  const known = new Set(GROUPS.flatMap((g) => g.types));
  const others = alerts.filter((a) => !known.has(a.alert_type)).sort(byRank);
  if (others.length) columns.push({ title: 'Other', items: others });

  return (
    <div>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold text-black">
            {alerts.length === 0 ? 'No alerts' : `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`}
          </span>
          <span className="font-medium text-gray-400">
            {' · '}
            {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm italic text-gray-400">No alerts flagged for this day.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              {/* Column header */}
              <div className="mb-2.5 flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', styleFor(col.items[0].alert_type).dot)} />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {col.title}
                </h3>
                <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-bold tabular-nums text-gray-500">
                  {col.items.length}
                </span>
              </div>

              {/* Stacked alerts (most severe on top) */}
              <div className="space-y-2.5">
                {col.items.map((alert, idx) => {
                  const style = styleFor(alert.alert_type);
                  const name = driverName(alert.driver_id);
                  return (
                    <div
                      key={`${alert.driver_id ?? 'station'}-${alert.alert_type}-${idx}`}
                      className={cn('rounded-2xl border p-3.5', style.bubble)}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                        <span className="text-sm font-bold leading-tight">{alert.label}</span>
                      </div>
                      <div className="truncate text-xs font-medium opacity-70">{name ?? 'Station'}</div>
                      {alert.detail && <div className="mt-0.5 text-xs opacity-60">{alert.detail}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
