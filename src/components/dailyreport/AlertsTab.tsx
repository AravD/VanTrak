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

  const sorted = [...alerts].sort((a, b) => styleFor(a.alert_type).rank - styleFor(b.alert_type).rank);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
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

      {/* Auto-derived alert bubbles (read-only) */}
      {alerts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-400 italic">No alerts flagged for this day.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((alert, idx) => {
            const style = styleFor(alert.alert_type);
            const name = driverName(alert.driver_id);
            return (
              <div
                key={`${alert.driver_id ?? 'station'}-${alert.alert_type}-${idx}`}
                className={cn('p-4 rounded-2xl border', style.bubble)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
                  <span className="font-bold text-sm leading-tight">{alert.label}</span>
                </div>
                <div className="text-xs opacity-70 font-medium truncate">
                  {name ?? 'Station'}
                </div>
                {alert.detail && (
                  <div className="text-xs opacity-60 mt-0.5">{alert.detail}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
