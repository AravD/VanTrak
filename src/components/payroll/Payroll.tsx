import { useCallback, useEffect, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useAuth } from "../../app/auth-context";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const API_URL = import.meta.env.VITE_AGENT_API_URL ?? "http://localhost:8000";
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

type DayTotal = { date: string; hours: string; pay: string };

type DayDetail = {
  date: string;
  hours: string;
  regular_hours: string;
  overtime_hours: string;
  doubletime_hours: string;
  hourly_rate: string;
  regular_pay: string;
  overtime_pay: string;
  doubletime_pay: string;
  total_pay: string;
};

type DriverRow = {
  driver_id: string;
  name: string;
  regular_hours: string;
  overtime_hours: string;
  doubletime_hours: string;
  hourly_rate: string;
  regular_pay: string;
  overtime_pay: string;
  doubletime_pay: string;
  total_pay: string;
  days: DayDetail[];
};

type Rates = {
  default_hourly_rate: string;
  overtime_multiplier: string;
  doubletime_multiplier: string;
  minimum_wage_floor: string | null;
  custom_rate_drivers: number;
};

type RateRecord = {
  driver_id: string;
  hourly_rate: string | number;
  overtime_multiplier: string | number | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
};

type PayrollWeek = {
  week_start: string;
  week_end: string;
  days: DayTotal[];
  drivers: DriverRow[];
  total_pay: string;
  rates: Rates;
  exceptions: { driver_id: string; date: string; issue: string }[];
};

const money = (value: string | number) =>
  Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });

const hoursLabel = (value: string) => {
  const amount = Number(value);
  return amount === 0 ? "—" : String(Number(amount.toFixed(2)));
};

export function Payroll({
  onNavigate,
}: {
  onNavigate?: (page: "dailyreport", options?: { date?: string }) => void;
}) {
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState<PayrollWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wagesOpen, setWagesOpen] = useState(false);
  const [rateDriver, setRateDriver] = useState<DriverRow | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setError("Sign in to view payroll.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/payroll/week?start=${format(weekStart, "yyyy-MM-dd")}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail ?? `Request failed (${response.status})`);
      }
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [session, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date()));

  return (
    <div className="mx-auto max-w-[1600px] p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-black">
            Payroll
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1">
            <NavButton
              label="Previous week"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </NavButton>
            <span className="min-w-[12rem] px-2 text-center text-sm font-medium tabular-nums text-black">
              {format(weekStart, "MMM d")} –{" "}
              {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <NavButton
              label="Next week"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </NavButton>
          </div>

          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-black transition-transform duration-150 ease-out hover:bg-gray-50 active:scale-[0.97]"
            >
              This week
            </button>
          )}

          <Button
            onClick={() => setWagesOpen(true)}
            className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Manage wages
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {(data?.days ?? Array.from({ length: 7 })).map((day, index) => (
              <DayBox
                key={index}
                day={day as DayTotal | undefined}
                loading={loading}
                onSelect={setSelectedDay}
              />
            ))}
            <div className="rounded-2xl bg-black p-4 text-white">
              <p className="text-xs font-medium text-white/60">Week total</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {loading || !data ? "—" : money(data.total_pay)}
              </p>
            </div>
          </section>

          {data && data.exceptions.length > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">
                  {data.exceptions.length} day
                  {data.exceptions.length === 1 ? "" : "s"} missing a clock-out
                </p>
                <p className="mt-0.5 text-amber-800">
                  Those hours are counted as zero. Fix them in Daily Report so
                  pay is accurate.
                </p>
              </div>
            </div>
          )}

          {data?.rates && (
            <RatesLegend rates={data.rates} onEdit={() => setWagesOpen(true)} />
          )}

          <DriverTable
            rows={data?.drivers ?? []}
            loading={loading}
            onEditRate={setRateDriver}
          />
        </>
      )}

      <ManageWagesSheet
        open={wagesOpen}
        onClose={() => setWagesOpen(false)}
        onSaved={load}
      />

      <DayDetailSheet
        date={selectedDay}
        drivers={data?.drivers ?? []}
        onClose={() => setSelectedDay(null)}
        onNavigate={onNavigate}
      />

      <DriverRateSheet
        driver={rateDriver}
        floor={data?.rates.minimum_wage_floor ?? null}
        onClose={() => setRateDriver(null)}
        onSaved={load}
      />
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="rounded-lg p-2 text-gray-500 transition-transform duration-150 ease-out hover:bg-gray-100 hover:text-black active:scale-[0.94]"
    >
      {children}
    </button>
  );
}

function RatesLegend({ rates, onEdit }: { rates: Rates; onEdit: () => void }) {
  const base = Number(rates.default_hourly_rate);
  const overtimeRate = base * Number(rates.overtime_multiplier);
  const doubletimeRate = base * Number(rates.doubletime_multiplier);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
        Rates
      </span>

      <Swatch color="bg-gray-400" label="Regular" value={money(base)} />
      <Swatch
        color="bg-amber-500"
        label={`Overtime ${Number(rates.overtime_multiplier)}×`}
        value={money(overtimeRate)}
      />
      <Swatch
        color="bg-red-500"
        label={`Double time ${Number(rates.doubletime_multiplier)}×`}
        value={money(doubletimeRate)}
      />

      <div className="ml-auto flex items-center gap-4">
        {rates.minimum_wage_floor && (
          <span className="text-xs tabular-nums text-gray-400">
            Floor {money(rates.minimum_wage_floor)}
          </span>
        )}
        {rates.custom_rate_drivers > 0 && (
          <span className="text-xs text-gray-400">
            {rates.custom_rate_drivers} on custom rates
          </span>
        )}
        <button
          onClick={onEdit}
          className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-transform duration-150 ease-out hover:bg-gray-100 hover:text-black active:scale-[0.97]"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function Swatch({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-black">
        {value}
      </span>
    </span>
  );
}

function DayBox({
  day,
  loading,
  onSelect,
}: {
  day?: DayTotal;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const isToday = day
    ? isSameDay(new Date(day.date + "T00:00:00"), new Date())
    : false;

  return (
    <button
      type="button"
      disabled={!day || loading}
      onClick={() => day && onSelect(day.date)}
      className={cn(
        "rounded-2xl border bg-white p-4 text-left transition-transform duration-150 ease-out",
        isToday ? "border-black" : "border-gray-200",
        day &&
          !loading &&
          "hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]",
      )}
    >
      <p className="text-xs font-medium text-gray-500">
        {day ? format(new Date(day.date + "T00:00:00"), "EEE d") : "—"}
      </p>
      {loading || !day ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded-md bg-gray-100" />
      ) : (
        <>
          <p className="mt-2 text-xl font-semibold tabular-nums text-black">
            {money(day.pay)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-gray-500">
            {hoursLabel(day.hours)} hrs
          </p>
        </>
      )}
    </button>
  );
}

function DriverTable({
  rows,
  loading,
  onEditRate,
}: {
  rows: DriverRow[];
  loading: boolean;
  onEditRate: (row: DriverRow) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-base font-semibold text-black">No hours this week</p>
        <p className="mt-1 text-sm text-gray-500">
          Payroll reads hours from Daily Report. Once roll call is filled in,
          totals appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-gray-100 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Driver</th>
              <th className="px-3 py-3 text-right font-medium">Rate</th>
              <th className="px-3 py-3 text-right font-medium">Reg hrs</th>
              <th className="px-3 py-3 text-right font-medium">OT hrs</th>
              <th className="px-3 py-3 text-right font-medium">DT hrs</th>
              <th className="px-3 py-3 text-right font-medium">Regular</th>
              <th className="px-3 py-3 text-right font-medium">Overtime</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.driver_id}
                className="border-b border-gray-50 transition-colors duration-100 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-black">{row.name}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => onEditRate(row)}
                    title={`Adjust ${row.name}'s rate`}
                    className="rounded-md px-2 py-1 tabular-nums text-gray-600 underline decoration-dotted decoration-gray-300 underline-offset-4 transition-colors duration-100 hover:bg-gray-100 hover:text-black hover:decoration-gray-500"
                  >
                    {money(row.hourly_rate)}
                  </button>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                  {hoursLabel(row.regular_hours)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                  {hoursLabel(row.overtime_hours)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-red-700">
                  {hoursLabel(row.doubletime_hours)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                  {money(row.regular_pay)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                  {money(row.overtime_pay)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-black">
                  {money(row.total_pay)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayDetailSheet({
  date,
  drivers,
  onClose,
  onNavigate,
}: {
  date: string | null;
  drivers: DriverRow[];
  onClose: () => void;
  onNavigate?: (page: "dailyreport", options?: { date?: string }) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!date) return;
    setQuery("");
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [date, onClose]);

  const logged = date
    ? drivers
        .map((driver) => ({
          driver,
          day: driver.days.find((entry) => entry.date === date),
        }))
        .filter((entry): entry is { driver: DriverRow; day: DayDetail } =>
          Boolean(entry.day),
        )
    : [];

  const visible = logged.filter(({ driver }) =>
    driver.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const dayTotal = logged.reduce(
    (sum, { day }) => sum + Number(day.total_pay),
    0,
  );

  return (
    <AnimatePresence>
      {date && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            onClick={onClose}
          />

          <motion.div
            className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white shadow-xl"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
            }
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {logged.length === 0
                    ? "Nothing logged"
                    : `${logged.length} driver${logged.length === 1 ? "" : "s"} · ${money(dayTotal)}`}
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition-transform duration-150 ease-out hover:bg-gray-100 hover:text-black active:scale-[0.94]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {logged.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-base font-semibold text-black">
                  No drivers have been logged for this day
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Hours come from Daily Report. Once roll call is filled in for
                  this date, drivers and their pay appear here.
                </p>
                {onNavigate && (
                  <Button
                    onClick={() => {
                      onNavigate("dailyreport", { date });
                      onClose();
                    }}
                    className="mt-5 rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
                  >
                    Open Daily Report
                  </Button>
                )}
              </div>
            ) : (
              <>
                {logged.length > 5 && (
                  <div className="border-b border-gray-100 px-5 py-3">
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search drivers…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>
                )}

                <ul className="divide-y divide-gray-50 overflow-y-auto p-2">
                  {visible.map(({ driver, day }) => (
                    <li key={driver.driver_id} className="rounded-xl px-3 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-black">
                          {driver.name}
                        </span>
                        <span className="font-semibold tabular-nums text-black">
                          {money(day.total_pay)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                        {hoursLabel(day.hours)} hrs → {describeSplit(day)}
                      </p>
                      <PayMath day={day} />
                    </li>
                  ))}

                  {visible.length === 0 && (
                    <li className="px-3 py-8 text-center text-sm text-gray-400">
                      No drivers match “{query}”.
                    </li>
                  )}
                </ul>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function describeSplit(day: DayDetail) {
  const parts = [
    Number(day.regular_hours) > 0 && `${hoursLabel(day.regular_hours)} regular`,
    Number(day.overtime_hours) > 0 &&
      `${hoursLabel(day.overtime_hours)} overtime`,
    Number(day.doubletime_hours) > 0 &&
      `${hoursLabel(day.doubletime_hours)} double time`,
  ].filter(Boolean) as string[];

  return parts.length > 0 ? parts.join(" + ") : "no paid hours";
}

function PayMath({ day }: { day: DayDetail }) {
  const rows = [
    {
      hours: Number(day.regular_hours),
      pay: Number(day.regular_pay),
      label: "regular",
      tone: "text-gray-500",
    },
    {
      hours: Number(day.overtime_hours),
      pay: Number(day.overtime_pay),
      label: "overtime",
      tone: "text-amber-700",
    },
    {
      hours: Number(day.doubletime_hours),
      pay: Number(day.doubletime_pay),
      label: "double time",
      tone: "text-red-700",
    },
  ].filter((row) => row.hours > 0);

  if (rows.length < 2) return null;

  return (
    <div className="mt-1.5 space-y-0.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn("flex justify-between text-xs tabular-nums", row.tone)}
        >
          <span>
            {row.hours} hrs {row.label} × {money(row.pay / row.hours)}
          </span>
          <span>{money(row.pay)}</span>
        </div>
      ))}
    </div>
  );
}

function DriverRateSheet({
  driver,
  floor,
  onClose,
  onSaved,
}: {
  driver: DriverRow | null;
  floor: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const reduceMotion = useReducedMotion();
  const [history, setHistory] = useState<RateRecord[]>([]);
  const [rate, setRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!driver || !session) return;

    setRate("");
    setNote("");
    setProblem(null);
    setEffectiveFrom(format(new Date(), "yyyy-MM-dd"));

    fetch(`${API_URL}/payroll/rates`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((response) => response.json())
      .then((records: RateRecord[]) =>
        setHistory(
          records
            .filter((record) => record.driver_id === driver.driver_id)
            .sort((a, b) => b.effective_from.localeCompare(a.effective_from)),
        ),
      )
      .catch(() => setProblem("Could not load rate history."));
  }, [driver, session]);

  useEffect(() => {
    if (!driver) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [driver, onClose]);

  const floorAmount = floor ? Number(floor) : 0;
  const rateAmount = Number(rate);
  const rateMissing =
    rate.trim() === "" || !Number.isFinite(rateAmount) || rateAmount <= 0;
  const belowFloor =
    !rateMissing && floorAmount > 0 && rateAmount < floorAmount;

  const blocking = rateMissing
    ? "Enter an hourly rate to save."
    : belowFloor
      ? `Rate cannot be below the minimum wage floor (${money(floor ?? 0)}).`
      : !effectiveFrom
        ? "Choose the date this rate takes effect."
        : null;

  async function save() {
    if (!session || !driver || blocking) return;
    setSaving(true);
    setProblem(null);

    try {
      const response = await fetch(`${API_URL}/payroll/rates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          driver_id: driver.driver_id,
          hourly_rate: rate,
          effective_from: effectiveFrom,
          note: note.trim() || null,
        }),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        const detail =
          typeof failure?.detail === "string" ? failure.detail : null;
        throw new Error(detail ?? `Save failed (${response.status})`);
      }

      onSaved();
      onClose();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {driver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
            }
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  {driver.name}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Currently {money(driver.hourly_rate)}/hr
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition-transform duration-150 ease-out hover:bg-gray-100 hover:text-black active:scale-[0.94]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {history.length > 0 && (
              <div className="mb-5 rounded-xl bg-[#FAFAFA] px-3 py-2">
                <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
                  Rate history
                </p>
                <ul className="divide-y divide-gray-100">
                  {history.map((record, index) => (
                    <li key={index} className="py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold tabular-nums text-black">
                          {money(record.hourly_rate)}
                        </span>
                        <span className="text-xs tabular-nums text-gray-500">
                          {record.effective_from}
                          {" → "}
                          {record.effective_to ?? "current"}
                        </span>
                      </div>
                      {record.note && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {record.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <Field
                label="New hourly rate"
                prefix="$"
                value={rate}
                onChange={setRate}
                invalid={rate.trim() !== "" && (rateMissing || belowFloor)}
                hint={
                  floorAmount > 0
                    ? `Must be at least ${money(floor ?? 0)}`
                    : "Set a minimum wage floor in Manage wages first"
                }
              />
              <label className="block">
                <span className="text-sm font-medium text-black">
                  Effective from
                </span>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-black"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  Earlier weeks keep the old rate
                </span>
              </label>
              <Field label="Note (optional)" value={note} onChange={setNote} />
            </div>

            {(blocking ?? problem) && (
              <p className="mt-4 text-sm text-red-600">{blocking ?? problem}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-transform duration-150 ease-out hover:bg-gray-100 active:scale-[0.97]"
              >
                Cancel
              </button>
              <Button
                onClick={save}
                disabled={saving || Boolean(blocking)}
                className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {saving ? "Saving…" : "Set rate"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ManageWagesSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const reduceMotion = useReducedMotion();
  const [rate, setRate] = useState("");
  const [overtime, setOvertime] = useState("");
  const [floor, setFloor] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !session) return;

    fetch(`${API_URL}/payroll/settings`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((response) => response.json())
      .then((settings) => {
        setRate(String(settings.default_hourly_rate ?? ""));
        setOvertime(String(settings.overtime_multiplier ?? ""));
        setFloor(
          settings.minimum_wage_floor
            ? String(settings.minimum_wage_floor)
            : "",
        );
      })
      .catch(() => setProblem("Could not load current wages."));
  }, [open, session]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function save() {
    if (!session || blockingMessage) return;
    setSaving(true);
    setProblem(null);

    try {
      const response = await fetch(`${API_URL}/payroll/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          default_hourly_rate: rate,
          overtime_multiplier: overtime,
          ...(floor ? { minimum_wage_floor: floor } : {}),
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        const detail =
          typeof failure?.detail === "string" ? failure.detail : null;
        throw new Error(detail ?? `Save failed (${response.status})`);
      }
      onSaved();
      onClose();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  const floorAmount = Number(floor);
  const rateAmount = Number(rate);
  const overtimeAmount = Number(overtime);

  const floorMissing =
    floor.trim() === "" || !Number.isFinite(floorAmount) || floorAmount <= 0;
  const rateMissing =
    rate.trim() === "" || !Number.isFinite(rateAmount) || rateAmount <= 0;
  const overtimeMissing =
    overtime.trim() === "" ||
    !Number.isFinite(overtimeAmount) ||
    overtimeAmount < 1;
  const rateBelowFloor =
    !floorMissing && !rateMissing && rateAmount < floorAmount;

  const stillNeeded = [
    rateMissing && "a default hourly rate",
    overtimeMissing && "an overtime multiplier of at least 1",
  ].filter(Boolean) as string[];

  const blockingMessage = floorMissing
    ? "Start with the minimum wage floor for your jurisdiction — the other fields unlock once it is set."
    : stillNeeded.length > 0
      ? `Please fill in every field before saving. Still needed: ${stillNeeded.join(" and ")}.`
      : rateBelowFloor
        ? `Hourly rate cannot be below the minimum wage floor (${money(floor)}).`
        : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
            }
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Manage wages
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Applies to every driver without a custom rate.
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition-transform duration-150 ease-out hover:bg-gray-100 hover:text-black active:scale-[0.94]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <Field
                label="Minimum wage floor"
                prefix="$"
                value={floor}
                onChange={setFloor}
                invalid={floorMissing}
                hint="Highest minimum wage that applies where drivers work (city, county, or state)."
              />
              <Field
                label="Default hourly rate"
                prefix="$"
                value={rate}
                onChange={setRate}
                disabled={floorMissing}
                invalid={!floorMissing && (rateMissing || rateBelowFloor)}
                hint={
                  floorMissing
                    ? "Set the minimum wage floor above first."
                    : undefined
                }
              />
              <Field
                label="Overtime multiplier"
                suffix="×"
                value={overtime}
                onChange={setOvertime}
                invalid={!floorMissing && overtimeMissing}
                hint="Most jurisdictions require at least 1.5×"
              />
            </div>

            {(blockingMessage ?? problem) && (
              <p className="mt-4 text-sm text-red-600">
                {blockingMessage ?? problem}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-transform duration-150 ease-out hover:bg-gray-100 active:scale-[0.97]"
              >
                Cancel
              </button>
              <Button
                onClick={save}
                disabled={saving || Boolean(blockingMessage)}
                className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  invalid,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", disabled && "opacity-50")}>
      <span className="text-sm font-medium text-black">{label}</span>
      <div
        className={cn(
          "mt-1.5 flex items-center rounded-xl border px-3 transition-colors duration-150",
          invalid
            ? "border-red-400"
            : "border-gray-200 focus-within:border-black",
        )}
      >
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent px-2 py-2 text-sm tabular-nums outline-none disabled:cursor-not-allowed"
        />
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}
