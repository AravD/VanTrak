import { cn } from '../../lib/utils';
import { RollCallRow, RollCallDriver } from '../../types/driver';
import { TableSkeleton } from './TableSkeleton';
import { TableEmpty } from './TableEmpty';
import { cellInput, DriverAvatar, StatusSelect, TimeInput, AutosaveStatus, type Tone } from './ui';

function getRoleOptions(notes: string | null): string[] {
  const n = (notes || '').toLowerCase();
  const options: string[] = ['Driver'];
  if (n.includes('rescue ready')) options.push('Rescue');
  if (n.includes('dispatcher')) options.push('Dispatcher');
  if (n.includes('helper')) options.push('Helper');
  return options;
}

const dvicTone = (v: string): Tone =>
  v === 'Completed' ? 'green' : v === 'Issue Reported' ? 'amber' : 'rose';
const attendanceTone = (v: string): Tone =>
  v === 'On Time' ? 'green' : v === 'Late' ? 'amber' : v === 'No Show' ? 'rose' : 'neutral';
const roleTone = (v: string): Tone => (v === 'Rescue' ? 'blue' : 'neutral');

interface RollCallTableProps {
  rows: RollCallRow[];
  drivers: RollCallDriver[];
  loading: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  onRowChange: (driverId: string, field: keyof RollCallRow, value: string) => void;
}

export function RollCallTable({
  rows,
  drivers,
  loading,
  saving,
  saveStatus,
  onRowChange,
}: RollCallTableProps) {
  if (loading) {
    return <TableSkeleton columns={8} />;
  }

  if (rows.length === 0) {
    return (
      <TableEmpty message="No one is scheduled for this date, so there's nothing to roll-call yet." />
    );
  }

  const th = 'px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400';

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className={cn(th, 'pl-6')}>Driver</th>
                <th className={th}>Route</th>
                <th className={th}>Role</th>
                <th className={th}>Attendance</th>
                <th className={th}>Arrival</th>
                <th className={th}>DVIC Status</th>
                <th className={th}>Van</th>
                <th className={th}>Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const driver = drivers.find((d) => d.driver_id === row.driver_id);
                const roleOptions = getRoleOptions(driver?.notes ?? null);
                const isNoShow = row.attendance_status === 'No Show';

                return (
                  <tr
                    key={row.driver_id}
                    className="transition-colors duration-150 hover:bg-gray-50/50"
                  >
                    <td className="py-3 pl-6 pr-5">
                      <div className="flex items-center gap-3">
                        <DriverAvatar first={driver?.first_name} last={driver?.last_name} />
                        <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
                          {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.route_number}
                        onChange={(e) => onRowChange(row.driver_id, 'route_number', e.target.value)}
                        className={cn(cellInput, 'w-24 text-center tabular-nums')}
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <StatusSelect
                        value={row.role}
                        options={roleOptions}
                        tone={roleTone(row.role)}
                        onChange={(v) => onRowChange(row.driver_id, 'role', v)}
                        className="w-36"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <StatusSelect
                        value={row.attendance_status}
                        options={['', 'On Time', 'Late', 'No Show']}
                        tone={attendanceTone(row.attendance_status)}
                        onChange={(v) => onRowChange(row.driver_id, 'attendance_status', v)}
                        className="w-40"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <TimeInput
                        value={row.arrival_time}
                        onChange={(v) => onRowChange(row.driver_id, 'arrival_time', v)}
                        disabled={isNoShow}
                        className="w-32"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <StatusSelect
                        value={row.dvic_status}
                        options={['Not Completed', 'Completed', 'Issue Reported']}
                        tone={dvicTone(row.dvic_status)}
                        onChange={(v) => onRowChange(row.driver_id, 'dvic_status', v)}
                        className="w-48"
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.van_number}
                        onChange={(e) => onRowChange(row.driver_id, 'van_number', e.target.value)}
                        className={cn(cellInput, 'w-20 text-center tabular-nums')}
                      />
                    </td>

                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.phone_assignment}
                        onChange={(e) => onRowChange(row.driver_id, 'phone_assignment', e.target.value)}
                        className={cn(cellInput, 'w-28 text-center tabular-nums')}
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
