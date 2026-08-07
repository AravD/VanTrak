import { cn } from '../../lib/utils';
import { OperationsRow, RollCallDriver } from '../../types/driver';
import { TableSkeleton } from './TableSkeleton';
import { TableEmpty } from './TableEmpty';
import { cellInput, DriverAvatar, StatusSelect, TimeInput, AutosaveStatus, type Tone } from './ui';

const routeStatusTone = (v: string): Tone =>
  v === 'Finished' ? 'green' : v === 'In Progress' ? 'amber' : v === 'Failed' ? 'rose' : 'neutral';

/** total_hours_worked is stored as decimal hours (e.g. 8.5) — show it as H:MM. */
function formatHours(value: string | null | undefined): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '—';
  const totalMinutes = Math.round(num * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

interface OperationsTableProps {
  rows: OperationsRow[];
  drivers: RollCallDriver[];
  loading: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  onRowChange: (driverId: string, field: keyof OperationsRow, value: string) => void;
}

export function OperationsTable({
  rows,
  drivers,
  loading,
  saving,
  saveStatus,
  onRowChange,
}: OperationsTableProps) {
  // Entering a Paycom logout time means the driver is done — advance the route
  // to Finished (unless it was explicitly marked Failed).
  const handleLogout = (row: OperationsRow, v: string) => {
    onRowChange(row.driver_id, 'paycom_logout_time', v);
    if (v && row.route_status !== 'Finished' && row.route_status !== 'Failed') {
      onRowChange(row.driver_id, 'route_status', 'Finished');
    }
  };

  if (loading) {
    return <TableSkeleton columns={9} rows={5} />;
  }

  if (rows.length === 0) {
    return (
      <TableEmpty message="No one is scheduled for this date, so there are no routes to track yet." />
    );
  }

  const th = 'px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400';

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className={cn(th, 'pl-6')}>Driver</th>
                <th className={th}>Stops</th>
                <th className={th}>Packages</th>
                <th className={th}>Status</th>
                <th className={th}>RTS</th>
                <th className={th}>Last Delivery</th>
                <th className={th}>Logout</th>
                <th className={th}>Hours</th>
                <th className={th}>Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const driver = drivers.find((d) => d.driver_id === row.driver_id);
                return (
                  <tr
                    key={row.driver_id}
                    className="transition-colors duration-150 hover:bg-gray-50/50"
                  >
                    <td className="py-3 pl-6 pr-5">
                      <div className="flex items-center gap-3">
                        <DriverAvatar first={driver?.first_name} last={driver?.last_name} />
                        <div className="leading-tight">
                          <div className="whitespace-nowrap text-sm font-semibold text-gray-900">
                            {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
                          </div>
                          {row.route_number && (
                            <div className="text-[11px] font-medium text-gray-400">
                              Route {row.route_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.stops_count}
                        onChange={(e) =>
                          onRowChange(row.driver_id, 'stops_count', e.target.value.replace(/\D/g, ''))
                        }
                        className={cn(cellInput, 'w-20 text-center tabular-nums')}
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.packages_count}
                        onChange={(e) =>
                          onRowChange(row.driver_id, 'packages_count', e.target.value.replace(/\D/g, ''))
                        }
                        className={cn(cellInput, 'w-20 text-center tabular-nums')}
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <StatusSelect
                        value={row.route_status}
                        options={['Not Started', 'In Progress', 'Finished', 'Failed']}
                        tone={routeStatusTone(row.route_status)}
                        onChange={(v) => onRowChange(row.driver_id, 'route_status', v)}
                        className="w-40"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.rts_number}
                        onChange={(e) => onRowChange(row.driver_id, 'rts_number', e.target.value)}
                        className={cn(cellInput, 'w-20 text-center tabular-nums')}
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <TimeInput
                        value={row.last_delivery_time}
                        onChange={(v) => onRowChange(row.driver_id, 'last_delivery_time', v)}
                        defaultMeridiem="PM"
                        className="w-32"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <TimeInput
                        value={row.paycom_logout_time}
                        onChange={(v) => handleLogout(row, v)}
                        defaultMeridiem="PM"
                        className="w-32"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <span
                        className={cn(
                          'inline-block min-w-[3rem] text-center text-sm font-semibold tabular-nums',
                          row.total_hours_worked ? 'text-gray-900' : 'text-gray-300',
                        )}
                        title="Hours worked = Paycom logout (PM) − arrival time (AM)"
                      >
                        {formatHours(row.total_hours_worked)}
                      </span>
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.closeout_notes}
                        onChange={(e) => onRowChange(row.driver_id, 'closeout_notes', e.target.value)}
                        className={cn(cellInput, 'w-72')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AutosaveStatus saving={saving} saveStatus={saveStatus} />
    </div>
  );
}
