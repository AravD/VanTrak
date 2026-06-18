import React, { useState } from 'react';
import { Check, AlertCircle, ChevronDown } from 'lucide-react';
import { cn, normalizeTimeInput } from '../../lib/utils';
import { OperationsRow, RollCallDriver } from '../../types/driver';

function routeStatusColor(value: string) {
  if (value === 'Finished') return 'border-green-200 bg-green-50 text-green-800';
  if (value === 'In Progress') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
  if (value === 'Failed') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-gray-100 bg-gray-50/50 text-gray-500';
}

interface OperationsTableProps {
  rows: OperationsRow[];
  drivers: RollCallDriver[];
  loading: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  onRowChange: (driverId: string, field: keyof OperationsRow, value: string) => void;
  onSave: () => void;
}

export function OperationsTable({
  rows,
  drivers,
  loading,
  saving,
  saveStatus,
  onRowChange,
  onSave,
}: OperationsTableProps) {
  const [routeOpen, setRouteOpen] = useState(true);
  const [endOfDayOpen, setEndOfDayOpen] = useState(true);

  type TimeField = 'last_delivery_time' | 'paycom_logout_time';
  // Allow free typing while focused; expand shorthand to HH:MM on blur.
  const handleTimeChange = (driverId: string, field: TimeField, raw: string) =>
    onRowChange(driverId, field, raw.replace(/[^\d:]/g, '').slice(0, 5));
  const handleTimeBlur = (driverId: string, field: TimeField, raw: string) =>
    onRowChange(driverId, field, normalizeTimeInput(raw));

  if (loading) {
    return <div className="py-20 text-center text-gray-400 italic text-sm">Loading operations...</div>;
  }

  if (rows.length === 0) {
    return <div className="py-20 text-center text-gray-400 italic text-sm">No drivers scheduled for this date.</div>;
  }

  const inputClass =
    'w-full px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 text-sm';
  const selectBase =
    'w-full px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black/5 text-sm font-medium';

  const driverCell = (row: OperationsRow) => {
    const driver = drivers.find((d) => d.driver_id === row.driver_id);
    return (
      <td className="px-4 py-3 w-36">
        <div className="font-bold text-black text-sm whitespace-nowrap leading-tight">
          {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
        </div>
        {row.route_number && (
          <div className="text-[11px] text-gray-400 leading-tight">({row.route_number})</div>
        )}
      </td>
    );
  };

  const thClass = 'px-4 py-3';

  return (
    <div className="space-y-6">
      {/* Route section */}
      <div>
        <button
          type="button"
          onClick={() => setRouteOpen((o) => !o)}
          aria-expanded={routeOpen}
          className="group flex items-center gap-2 mb-2 px-1 cursor-pointer"
        >
          <ChevronDown
            size={14}
            className={cn(
              'text-gray-400 transition-transform duration-200 ease-out group-hover:text-black',
              !routeOpen && '-rotate-90',
            )}
          />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">
            Route
          </h3>
        </button>
        {routeOpen && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
                  <th className={thClass}>Driver</th>
                  <th className={thClass}>Stops / Packages</th>
                  <th className={thClass}>Route Status</th>
                  <th className={thClass}>Rescue Notes</th>
                  <th className={thClass}>RTS #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.driver_id} className="hover:bg-gray-50/30 transition-colors">
                    {driverCell(row)}

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.stops_count}
                          onChange={(e) =>
                            onRowChange(row.driver_id, 'stops_count', e.target.value.replace(/\D/g, ''))
                          }
                          className={cn(inputClass, 'w-16')}
                        />
                        <span className="text-gray-300 font-medium text-sm">/</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.packages_count}
                          onChange={(e) =>
                            onRowChange(row.driver_id, 'packages_count', e.target.value.replace(/\D/g, ''))
                          }
                          className={cn(inputClass, 'w-16')}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={row.route_status}
                        onChange={(e) => onRowChange(row.driver_id, 'route_status', e.target.value)}
                        className={cn(selectBase, 'w-36', routeStatusColor(row.route_status))}
                      >
                        <option>Not Started</option>
                        <option>In Progress</option>
                        <option>Finished</option>
                        <option>Failed</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.rescue_notes}
                        onChange={(e) => onRowChange(row.driver_id, 'rescue_notes', e.target.value)}
                        className={cn(inputClass, 'w-52')}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.rts_number}
                        onChange={(e) => onRowChange(row.driver_id, 'rts_number', e.target.value)}
                        className={cn(inputClass, 'w-20')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* End of Day section */}
      <div>
        <button
          type="button"
          onClick={() => setEndOfDayOpen((o) => !o)}
          aria-expanded={endOfDayOpen}
          className="group flex items-center gap-2 mb-2 px-1 cursor-pointer"
        >
          <ChevronDown
            size={14}
            className={cn(
              'text-gray-400 transition-transform duration-200 ease-out group-hover:text-black',
              !endOfDayOpen && '-rotate-90',
            )}
          />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">
            End of Day
          </h3>
        </button>
        {endOfDayOpen && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
                  <th className={thClass}>Driver</th>
                  <th className={thClass}>Last Delivery</th>
                  <th className={thClass}>Paycom Logout</th>
                  <th className={thClass}>Total Hours</th>
                  <th className={thClass}>Closeout Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.driver_id} className="hover:bg-gray-50/30 transition-colors">
                    {driverCell(row)}

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.last_delivery_time}
                        onChange={(e) => handleTimeChange(row.driver_id, 'last_delivery_time', e.target.value)}
                        onBlur={(e) => handleTimeBlur(row.driver_id, 'last_delivery_time', e.target.value)}
                        className={cn(inputClass, 'w-24')}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.paycom_logout_time}
                        onChange={(e) => handleTimeChange(row.driver_id, 'paycom_logout_time', e.target.value)}
                        onBlur={(e) => handleTimeBlur(row.driver_id, 'paycom_logout_time', e.target.value)}
                        className={cn(inputClass, 'w-24')}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block min-w-[3rem] text-sm tabular-nums',
                          row.total_hours_worked ? 'text-black' : 'text-gray-300',
                        )}
                        title="Auto-calculated by the database: Paycom logout − arrival time"
                      >
                        {row.total_hours_worked ? row.total_hours_worked : '----'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.closeout_notes}
                        onChange={(e) => onRowChange(row.driver_id, 'closeout_notes', e.target.value)}
                        className={cn(inputClass, 'w-72')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
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
          {saving ? 'Saving...' : 'Save Operations'}
        </button>
      </div>
    </div>
  );
}
