import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, X, Trash2, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { DailyIssue, ISSUE_TYPES, RollCallDriver } from '../../types/driver';
import { useAuth } from '../../app/auth-context';

function issueTypeColor(type: string) {
  switch (type) {
    case 'Van Damage':       return 'bg-orange-50 border-orange-200 text-orange-800';
    case 'Phone Issue':      return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'Route Issue':      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    case 'Package Issue':    return 'bg-purple-50 border-purple-200 text-purple-800';
    case 'Attendance Issue': return 'bg-red-50 border-red-200 text-red-800';
    case 'Customer Incident':return 'bg-pink-50 border-pink-200 text-pink-800';
    case 'Safety Incident':  return 'bg-red-100 border-red-300 text-red-900';
    default:                 return 'bg-gray-50 border-gray-200 text-gray-700';
  }
}

function issueTypeDot(type: string) {
  switch (type) {
    case 'Van Damage':       return 'bg-orange-400';
    case 'Phone Issue':      return 'bg-blue-400';
    case 'Route Issue':      return 'bg-yellow-400';
    case 'Package Issue':    return 'bg-purple-400';
    case 'Attendance Issue': return 'bg-red-400';
    case 'Customer Incident':return 'bg-pink-400';
    case 'Safety Incident':  return 'bg-red-600';
    default:                 return 'bg-gray-400';
  }
}

interface IssuesTabProps {
  selectedDate: string;
  activeStationId: string;
  drivers: RollCallDriver[];
  /** Issues for the selected day, owned by the parent (DailyReport). */
  issues: DailyIssue[];
  /** Called after a log / edit / delete so the parent can refetch. */
  onChanged: () => void | Promise<void>;
}

interface FormState {
  issue_date: string;
  issue_type: string;
  driver_id: string;
  notes: string;
}

const emptyForm = (date: string): FormState => ({
  issue_date: date,
  issue_type: ISSUE_TYPES[0],
  driver_id: '',
  notes: '',
});

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-black/5 text-sm';

function FormFields({
  values,
  onChange,
  drivers,
}: {
  values: FormState;
  onChange: (f: FormState) => void;
  drivers: RollCallDriver[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          Issue Date
        </label>
        <input
          type="date"
          value={values.issue_date}
          onChange={(e) => onChange({ ...values, issue_date: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          Issue Type
        </label>
        <select
          value={values.issue_type}
          onChange={(e) => onChange({ ...values, issue_type: e.target.value })}
          className={inputClass}
        >
          {ISSUE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          Driver <span className="normal-case font-normal text-gray-400">(Optional)</span>
        </label>
        <select
          value={values.driver_id}
          onChange={(e) => onChange({ ...values, driver_id: e.target.value })}
          className={inputClass}
        >
          <option value="">No Driver / Station Issue</option>
          {drivers.map((d) => (
            <option key={d.driver_id} value={d.driver_id}>
              {d.first_name} {d.last_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          Notes <span className="normal-case font-normal text-red-400">*</span>
        </label>
        <textarea
          value={values.notes}
          onChange={(e) => onChange({ ...values, notes: e.target.value })}
          rows={4}
          className={cn(inputClass, 'resize-none')}
          placeholder="Describe the issue..."
        />
      </div>
    </div>
  );
}

export function IssuesTab({ selectedDate, activeStationId, drivers, issues, onChanged }: IssuesTabProps) {
  const { hasPermission } = useAuth();
  const canLog = hasPermission('reports.issues.log');
  // Log modal
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(selectedDate));
  const [logSaving, setLogSaving] = useState(false);
  const [logStatus, setLogStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Detail modal
  const [selected, setSelected] = useState<DailyIssue | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm(selectedDate));
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep log form date in sync when the selected day changes
  useEffect(() => {
    setForm((f) => ({ ...f, issue_date: selectedDate }));
  }, [selectedDate]);

  const driverName = (id: string | null) => {
    if (!id) return null;
    const d = drivers.find((dr) => dr.driver_id === id);
    return d ? `${d.first_name} ${d.last_name}` : null;
  };

  // ── Log Issue ─────────────────────────────────────────────────────────────

  const openLog = () => {
    setForm(emptyForm(selectedDate));
    setLogStatus('idle');
    setShowLog(true);
  };

  const handleLog = async () => {
    if (!form.notes.trim()) return;
    setLogSaving(true);
    setLogStatus('idle');
    const now = new Date().toISOString();
    const { error } = await supabase.from('daily_issues').insert({
      issue_date: form.issue_date,
      station_id: activeStationId || null,
      driver_id: form.driver_id || null,
      issue_type: form.issue_type,
      notes: form.notes.trim(),
      created_at: now,
      updated_at: now,
    });
    if (error) {
      setLogStatus('error');
    } else {
      setLogStatus('success');
      await onChanged();
      setTimeout(() => setShowLog(false), 800);
    }
    setLogSaving(false);
  };

  // ── Detail / Edit ─────────────────────────────────────────────────────────

  const openDetail = (issue: DailyIssue) => {
    setSelected(issue);
    setEditForm({
      issue_date: issue.issue_date,
      issue_type: issue.issue_type,
      driver_id: issue.driver_id ?? '',
      notes: issue.notes,
    });
    setDetailStatus('idle');
    setConfirmDelete(false);
  };

  const handleSaveEdit = async () => {
    if (!selected || !editForm.notes.trim()) return;
    setDetailSaving(true);
    setDetailStatus('idle');
    const { error } = await supabase
      .from('daily_issues')
      .update({
        issue_date: editForm.issue_date,
        issue_type: editForm.issue_type,
        driver_id: editForm.driver_id || null,
        notes: editForm.notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    if (error) {
      setDetailStatus('error');
    } else {
      setDetailStatus('success');
      await onChanged();
      setTimeout(() => setSelected(null), 800);
    }
    setDetailSaving(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDetailSaving(true);
    const { error } = await supabase.from('daily_issues').delete().eq('id', selected.id);
    if (!error) {
      await onChanged();
      setSelected(null);
    }
    setDetailSaving(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm">
          <span className="font-bold text-black">
            {issues.length === 0 ? 'No issues' : `${issues.length} issue${issues.length === 1 ? '' : 's'}`}
          </span>
          <span className="font-medium text-gray-400">
            {' · '}
            {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {canLog && (
          <button
            onClick={openLog}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-[0.97]"
          >
            <Plus size={15} />
            Log Issue
          </button>
        )}
      </div>

      {/* Daily issue list */}
      {issues.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-400 italic">No issues logged for this day.</p>
          <button
            onClick={openLog}
            className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            + Log the first issue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {issues.map((issue) => {
            const name = driverName(issue.driver_id);
            return (
              <button
                key={issue.id}
                onClick={() => openDetail(issue)}
                className={cn(
                  'text-left p-4 rounded-2xl border transition-all hover:shadow-md active:scale-[0.99]',
                  issueTypeColor(issue.issue_type),
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', issueTypeDot(issue.issue_type))} />
                  <span className="font-bold text-sm leading-tight">{issue.issue_type}</span>
                </div>
                {name && (
                  <div className="text-xs opacity-70 font-medium mb-1 truncate">{name}</div>
                )}
                <div className="text-xs opacity-70 leading-snug line-clamp-3">{issue.notes}</div>
                <div className="text-[10px] opacity-50 mt-2">
                  {format(parseISO(issue.created_at), 'h:mm a')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Log Issue Modal ───────────────────────────────────────────────── */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-black">Log Issue</h2>
              <button onClick={() => setShowLog(false)} className="text-gray-400 hover:text-black transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <FormFields values={form} onChange={setForm} drivers={drivers} />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div>
                {logStatus === 'success' && (
                  <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                    <Check size={14} /> Saved
                  </span>
                )}
                {logStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                    <AlertCircle size={14} /> Failed to save
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLog(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLog}
                  disabled={logSaving || !form.notes.trim()}
                  className={cn(
                    'px-5 py-2 rounded-xl bg-black text-white text-sm font-bold transition-all',
                    logSaving || !form.notes.trim() ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800',
                  )}
                >
                  {logSaving ? 'Saving...' : 'Log Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Edit Modal ───────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-black">Issue Details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-black transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <FormFields values={editForm} onChange={setEditForm} drivers={drivers} />

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[11px] text-gray-400">
                  Logged {format(parseISO(selected.created_at), 'MMM d, yyyy · h:mm a')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-500 font-medium">Are you sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={detailSaving}
                      className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div>
                  {detailStatus === 'success' && (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                      <Check size={14} /> Saved
                    </span>
                  )}
                  {detailStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                      <AlertCircle size={14} /> Failed
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={detailSaving || !editForm.notes.trim()}
                  className={cn(
                    'px-5 py-2 rounded-xl bg-black text-white text-sm font-bold transition-all',
                    detailSaving || !editForm.notes.trim() ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800',
                  )}
                >
                  {detailSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
