import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { cn, normalizeTimeInput } from '../../lib/utils';
import { RollCallRow, RollCallDriver } from '../../types/driver';

function getRoleOptions(notes: string | null): string[] {
  const n = (notes || '').toLowerCase();
  const options: string[] = ['Driver'];
  if (n.includes('rescue ready')) options.push('Rescue');
  if (n.includes('dispatcher')) options.push('Dispatcher');
  if (n.includes('helper')) options.push('Helper');
  return options;
}

function dvicColor(value: string) {
  if (value === 'Completed') return 'border-green-200 bg-green-50 text-green-800';
  if (value === 'Issue Reported') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
  return 'border-red-200 bg-red-50 text-red-800'; // Not Completed
}

function roleColor(value: string) {
  if (value === 'Rescue') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-gray-100 bg-gray-50/50 text-gray-700';
}

function attendanceColor(value: string) {
  if (value === 'On Time') return 'border-green-200 bg-green-50 text-green-800';
  if (value === 'Late') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
  if (value === 'No Show') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-gray-100 bg-gray-50/50 text-gray-500'; // empty/unset
}

interface RollCallTableProps {
  rows: RollCallRow[];
  drivers: RollCallDriver[];
  loading: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  onRowChange: (driverId: string, field: keyof RollCallRow, value: string) => void;
  onSave: () => void;
}

export function RollCallTable({
  rows,
  drivers,
  loading,
  saving,
  saveStatus,
  onRowChange,
  onSave,
}: RollCallTableProps) {
  if (loading) {
    return (
      <div className="py-20 text-center text-gray-400 italic text-sm">
        Loading roll call...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400 italic text-sm">
        No drivers scheduled for this date.
      </div>
    );
  }

  // Allow free typing while focused; expand shorthand to HH:MM on blur.
  const handleTimeChange = (driverId: string, raw: string) =>
    onRowChange(driverId, 'arrival_time', raw.replace(/[^\d:]/g, '').slice(0, 5));
  const handleTimeBlur = (driverId: string, raw: string) =>
    onRowChange(driverId, 'arrival_time', normalizeTimeInput(raw));

  const inputClass =
    'w-full px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 text-sm';
  const selectBase =
    'w-full px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black/5 text-sm font-medium';

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Arrival Time</th>
                <th className="px-4 py-3">DVIC Status</th>
                <th className="px-4 py-3">Van</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const driver = drivers.find((d) => d.driver_id === row.driver_id);
                const roleOptions = getRoleOptions(driver?.notes ?? null);
                const isNoShow = row.attendance_status === 'No Show';

                return (
                  <tr key={row.driver_id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-black text-sm whitespace-nowrap">
                        {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.route_number}
                        onChange={(e) => onRowChange(row.driver_id, 'route_number', e.target.value)}
                        className={cn(inputClass, 'w-24')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.role}
                        onChange={(e) => onRowChange(row.driver_id, 'role', e.target.value)}
                        className={cn(selectBase, 'w-32', roleColor(row.role))}
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.attendance_status}
                        onChange={(e) =>
                          onRowChange(row.driver_id, 'attendance_status', e.target.value)
                        }
                        className={cn(selectBase, 'w-32', attendanceColor(row.attendance_status))}
                      >
                        <option value=""></option>
                        <option>On Time</option>
                        <option>Late</option>
                        <option>No Show</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.arrival_time}
                        onChange={(e) => handleTimeChange(row.driver_id, e.target.value)}
                        onBlur={(e) => handleTimeBlur(row.driver_id, e.target.value)}
                        disabled={isNoShow}
                        className={cn(
                          inputClass,
                          'w-28',
                          isNoShow && 'opacity-30 cursor-not-allowed',
                        )}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.dvic_status}
                        onChange={(e) => onRowChange(row.driver_id, 'dvic_status', e.target.value)}
                        className={cn(selectBase, 'w-40', dvicColor(row.dvic_status))}
                      >
                        <option>Not Completed</option>
                        <option>Completed</option>
                        <option>Issue Reported</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.van_number}
                        onChange={(e) => onRowChange(row.driver_id, 'van_number', e.target.value)}
                        className={cn(inputClass, 'w-20')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.phone_assignment}
                        onChange={(e) =>
                          onRowChange(row.driver_id, 'phone_assignment', e.target.value)
                        }
                        className={cn(inputClass, 'w-24')}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 mt-4">
        {saveStatus === 'success' && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <Check size={15} />
            Saved successfully
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
            <AlertCircle size={15} />
            Failed to save
          </div>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className={cn(
            'px-6 py-2.5 rounded-xl bg-black text-white font-bold text-sm transition-all shadow-lg shadow-gray-200',
            saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800',
          )}
        >
          {saving ? 'Saving...' : 'Save Roll Call'}
        </button>
      </div>
    </div>
  );
}
