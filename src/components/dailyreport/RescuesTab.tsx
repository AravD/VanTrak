import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LifeBuoy, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../app/auth-context';
import { cn } from '../../lib/utils';
import { RollCallDriver } from '../../types/driver';

interface RescueRow {
  id: string;
  rescuer_id: string;
  rescuee_id: string;
  stops: number | null;
  packages: number | null;
  notes: string | null;
  created_at: string;
  rescuer: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  rescuee: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}

const FIELD =
  'w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] duration-150 focus:border-gray-900 focus:outline-none focus:ring-4 focus:ring-black/5';
const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400';

// A driver can rescue only if they carry the "Rescue Ready" tag on their notes.
const isRescueReady = (d: RollCallDriver) => (d.notes ?? '').toLowerCase().includes('rescue ready');

const nameOf = (embed: RescueRow['rescuer']) => {
  const p = Array.isArray(embed) ? embed[0] : embed;
  return p ? `${p.first_name} ${p.last_name}` : '—';
};

export function RescuesTab({
  selectedDate,
  drivers,
  stationId,
}: {
  selectedDate: string;
  drivers: RollCallDriver[];
  stationId?: string;
}) {
  const { membership } = useAuth();
  const businessId = membership?.businessId ?? null;

  const [rescues, setRescues] = useState<RescueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('rescues')
      .select(
        'id, rescuer_id, rescuee_id, stops, packages, notes, created_at, rescuer:drivers!rescuer_id(first_name,last_name), rescuee:drivers!rescuee_id(first_name,last_name)',
      )
      .eq('report_date', selectedDate)
      .order('created_at', { ascending: false });
    if (!err) setRescues((data as unknown as RescueRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const addRescue = async (entry: {
    rescuerId: string;
    rescueeId: string;
    stops: string;
    packages: string;
    notes: string;
  }) => {
    setError(null);
    const { error: err } = await supabase.from('rescues').insert({
      business_id: businessId,
      report_date: selectedDate,
      station_id: stationId || null,
      rescuer_id: entry.rescuerId,
      rescuee_id: entry.rescueeId,
      stops: entry.stops ? parseInt(entry.stops, 10) : null,
      packages: entry.packages ? parseInt(entry.packages, 10) : null,
      notes: entry.notes || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    load();
  };

  const removeRescue = async (id: string) => {
    await supabase.from('rescues').delete().eq('id', id);
    load();
  };

  return (
    <div>
      {/* Header — count + Log Rescue */}
      <div className="mb-5 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold text-black">
            {rescues.length === 0 ? 'No rescues' : `${rescues.length} rescue${rescues.length === 1 ? '' : 's'}`}
          </span>
          <span className="font-medium text-gray-400"> logged</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-gray-200 transition-transform duration-150 ease-out hover:bg-gray-800 active:scale-[0.98]"
        >
          <Plus size={18} />
          Log Rescue
        </button>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}

      {/* View area */}
      {loading ? (
        <div className="py-20 text-center text-sm italic text-gray-400">Loading…</div>
      ) : rescues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-blue-50 text-blue-500">
            <LifeBuoy size={22} />
          </span>
          <p className="text-sm font-semibold text-gray-900">No rescues logged yet</p>
          <p className="mt-1 max-w-xs text-sm text-gray-400">
            When a Rescue-Ready driver takes over part of another driver's route, log it here.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-5 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-black active:scale-[0.98]"
          >
            <Plus size={16} />
            Log Rescue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rescues.map((r) => (
            <div key={r.id} className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-500">
                  <LifeBuoy size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-gray-900">
                    {nameOf(r.rescuer)} <span className="font-medium text-gray-400">rescued</span> {nameOf(r.rescuee)}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    <span className="tabular-nums">{r.stops ?? 0}</span> stops ·{' '}
                    <span className="tabular-nums">{r.packages ?? 0}</span> packages
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRescue(r.id)}
                  title="Delete rescue"
                  className="shrink-0 rounded-lg p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <X size={15} />
                </button>
              </div>
              {r.notes && (
                <p className="mt-3 border-t border-gray-50 pt-3 text-xs leading-relaxed text-gray-500">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <LogRescueModal drivers={drivers} onClose={() => setOpen(false)} onSave={addRescue} />}
    </div>
  );
}

function LogRescueModal({
  drivers,
  onClose,
  onSave,
}: {
  drivers: RollCallDriver[];
  onClose: () => void;
  onSave: (entry: { rescuerId: string; rescueeId: string; stops: string; packages: string; notes: string }) => void;
}) {
  const [rescuerId, setRescuerId] = useState('');
  const [rescueeId, setRescueeId] = useState('');
  const [stops, setStops] = useState('');
  const [packages, setPackages] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rescuers = drivers.filter(isRescueReady);
  const rescuees = drivers.filter((d) => d.driver_id !== rescuerId);
  const canSave = rescuerId !== '' && rescueeId !== '';

  const submit = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    await onSave({ rescuerId, rescueeId, stops, packages, notes: notes.trim() });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-8 pb-5 pt-8">
          <h2 className="text-2xl font-bold tracking-tight">Log a rescue</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-8 pb-2">
          <div className="space-y-1.5">
            <label className={LABEL}>Rescuer</label>
            <select value={rescuerId} onChange={(e) => setRescuerId(e.target.value)} autoFocus className={FIELD}>
              <option value="">Select a rescuer…</option>
              {rescuers.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
            {rescuers.length === 0 && (
              <p className="text-[11px] text-gray-400">
                No drivers are tagged “Rescue Ready.” Add the tag on the Driver Contacts page.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Rescued driver</label>
            <select value={rescueeId} onChange={(e) => setRescueeId(e.target.value)} className={FIELD}>
              <option value="">Select who was rescued…</option>
              {rescuees.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Stops rescued</label>
              <input
                inputMode="numeric"
                value={stops}
                onChange={(e) => setStops(e.target.value.replace(/\D/g, ''))}
                className={cn(FIELD, 'tabular-nums')}
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Packages rescued</label>
              <input
                inputMode="numeric"
                value={packages}
                onChange={(e) => setPackages(e.target.value.replace(/\D/g, ''))}
                className={cn(FIELD, 'tabular-nums')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cn(LABEL, 'flex items-center justify-between')}>
              Notes <span className="font-normal normal-case tracking-normal text-gray-300">Optional</span>
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(FIELD, 'resize-none')} />
          </div>
        </div>

        <div className="flex gap-3 px-8 py-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-100 px-6 py-3 font-bold text-gray-500 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave || submitting}
            className={cn(
              'flex-1 rounded-xl bg-black px-6 py-3 font-bold text-white shadow-lg shadow-gray-200 transition-all',
              canSave && !submitting ? 'hover:bg-gray-800 active:scale-[0.98]' : 'cursor-not-allowed opacity-50',
            )}
          >
            {submitting ? 'Logging…' : 'Log Rescue'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
