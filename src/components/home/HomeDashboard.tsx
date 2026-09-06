import { useEffect, useState } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import {
  CalendarDays,
  Users,
  Truck,
  AlertTriangle,
  Info,
  Gauge,
  Mail,
  Trash2,
  CalendarClock,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { BentoGrid, BentoCard } from "../ui/bento-grid";
import { useAuth } from "../../app/auth-context";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";

type Page = "schedule" | "contacts" | "timeoff" | "dailyreport" | "saveinfo" | "team" | "home";

interface HomeDashboardProps {
  onNavigate: (page: Page) => void;
}

type Tone = "amber" | "red" | "gray";

interface AttentionItem {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail: string;
  page: Page;
}

interface DashboardData {
  scheduled: number;
  stationCount: number;
  capacity: number;
  rollTotal: number;
  present: number;
  routesDone: number;
  routesInProgress: number;
  routesNotStarted: number;
  issuesToday: number;
  issuesWeek: number;
  attention: AttentionItem[];
}

const TONE: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  gray: "bg-gray-100 text-gray-500",
};

/** Attendance values that mean the driver showed up (vs. No Show / unmarked). */
const PRESENT = new Set(["On Time", "Late"]);

function pickDriver(ex: { drivers?: unknown }): { first_name?: string; last_name?: string } | null {
  const d = ex.drivers;
  if (Array.isArray(d)) return (d[0] as never) ?? null;
  return (d as never) ?? null;
}

/**
 * Home / operations dashboard. Whole-business scope (RLS already limits every
 * query to the caller's business). Each widget is permission-gated so people
 * only ever see what their role allows.
 */
export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const { hasPermission, session, isGuest } = useAuth();

  const canSchedule = hasPermission("schedule.view");
  const canReports = hasPermission("reports.view");
  const canApproveTimeOff = hasPermission("timeoff.approve");
  const canRollCall = hasPermission("reports.rollcall.edit") || canReports;
  const canInvite = hasPermission("admin.invite");
  const canExport = hasPermission("reports.export");

  const [firstName, setFirstName] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const today = format(now, "yyyy-MM-dd");
        const ws = startOfWeek(now, { weekStartsOn: 0 });
        const weekStart = format(ws, "yyyy-MM-dd");
        const weekEnd = format(addDays(ws, 6), "yyyy-MM-dd");
        const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString();

        const [assignRes, reqRes, rollRes, issuesRes, exceptionsRes, profileRes] =
          await Promise.all([
            supabase
              .from("schedule_assignments")
              .select("id", { count: "exact", head: true })
              .eq("work_date", today),
            supabase
              .from("station_requirements")
              .select("station_id, da_count, capacity, okami")
              .eq("work_date", today),
            supabase
              .from("daily_roll_call")
              .select("attendance_status, route_status, paycom_logout_time")
              .eq("report_date", today),
            supabase
              .from("daily_issues")
              .select("id, issue_date")
              .gte("issue_date", weekStart)
              .lte("issue_date", weekEnd),
            supabase
              .from("schedule_exceptions")
              .select(
                "id, exception_type, start_date, drivers:driver_id ( first_name, last_name )",
              )
              .eq("status", "Pending")
              .order("start_date", { ascending: true }),
            session
              ? supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        // Optional widgets — only query what the role can see.
        const [invitesRes, exportsRes] = await Promise.all([
          canInvite
            ? supabase.from("invites").select("id").eq("status", "pending")
            : Promise.resolve({ data: [] as { id: string }[] }),
          canExport
            ? supabase
                .from("data_export_log")
                .select("id")
                .is("purged_at", null)
                .lte("expires_at", soon)
            : Promise.resolve({ data: [] as { id: string }[] }),
        ]);

        if (!active) return;

        const reqs = (reqRes.data ?? []) as {
          da_count: number | null;
          capacity: number | null;
          okami: number | null;
        }[];
        const roll = (rollRes.data ?? []) as {
          attendance_status: string | null;
          route_status: string | null;
          paycom_logout_time: string | null;
        }[];
        const issues = (issuesRes.data ?? []) as { issue_date: string }[];
        const exceptions = (exceptionsRes.data ?? []) as {
          id: string;
          exception_type: string | null;
          drivers?: unknown;
        }[];

        const scheduled = assignRes.count ?? 0;
        const capacity = reqs.reduce((s, r) => s + (r.capacity ?? 0), 0);
        // capacity = da_count − okami = drivers free to spare. Only meaningful
        // once okami (routes needed) has been entered for the station/day.
        const capRows = reqs.filter((r) => r.okami != null);
        const driverDeficit = capRows.reduce((s, r) => s + Math.max(0, -(r.capacity ?? 0)), 0);
        const noSpareDrivers = capRows.some((r) => (r.capacity ?? 0) === 0);

        const rollTotal = roll.length;
        const present = roll.filter((r) => r.attendance_status && PRESENT.has(r.attendance_status)).length;
        // A route is Done once it's marked Finished or the driver has a logout
        // time; In Progress once started; otherwise Not Started.
        const routeDone = (r: { route_status: string | null; paycom_logout_time: string | null }) =>
          r.route_status === "Finished" || (r.paycom_logout_time ?? "").trim() !== "";
        const routesDone = roll.filter(routeDone).length;
        const routesInProgress = roll.filter((r) => !routeDone(r) && r.route_status === "In Progress").length;
        const routesNotStarted = roll.filter(
          (r) => !routeDone(r) && (r.route_status ?? "Not Started") === "Not Started",
        ).length;

        // A driver is "accounted for" once their attendance is marked (On Time /
        // Late / No Show). Anyone scheduled but still blank is unaccounted.
        const accountedFor = roll.filter((r) => (r.attendance_status ?? "").trim() !== "").length;
        const unaccounted = Math.max(0, scheduled - accountedFor);

        const issuesWeek = issues.length;
        const issuesToday = issues.filter((i) => i.issue_date === today).length;

        const pendingInvites = (invitesRes.data ?? []).length;
        const expiringExports = (exportsRes.data ?? []).length;

        // Build the "needs attention" list — each entry gated + only when non-zero.
        const attention: AttentionItem[] = [];
        if (canApproveTimeOff && exceptions.length > 0) {
          const d = pickDriver(exceptions[0]);
          const who = d ? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() : "A driver";
          attention.push({
            id: "timeoff",
            icon: CalendarClock,
            tone: "amber",
            title: `${exceptions.length} time-off request${exceptions.length > 1 ? "s" : ""} pending`,
            detail: exceptions.length === 1 ? `${who} · ${exceptions[0].exception_type ?? "Time Off"}` : `Starting with ${who}`,
            page: "timeoff",
          });
        }
        if (canRollCall && scheduled > 0 && unaccounted > 0) {
          const started = accountedFor > 0;
          attention.push({
            id: "rollcall",
            icon: ClipboardCheck,
            tone: "amber",
            title: started ? "Roll call incomplete" : "Roll call not started",
            detail: started
              ? `${unaccounted} of ${scheduled} driver${scheduled > 1 ? "s" : ""} not yet accounted for`
              : `${scheduled} driver${scheduled > 1 ? "s" : ""} to account for today`,
            page: "dailyreport",
          });
        }
        if (canSchedule && driverDeficit > 0) {
          attention.push({
            id: "capacity",
            icon: AlertTriangle,
            tone: "red",
            title: "Not enough drivers today",
            detail: `Short ${driverDeficit} driver${driverDeficit > 1 ? "s" : ""} to cover the day's routes`,
            page: "schedule",
          });
        } else if (canSchedule && noSpareDrivers) {
          attention.push({
            id: "capacity",
            icon: Gauge,
            tone: "amber",
            title: "No spare drivers today",
            detail: "Every driver is assigned — no coverage to spare",
            page: "schedule",
          });
        }
        if (canInvite && pendingInvites > 0) {
          attention.push({
            id: "invites",
            icon: Mail,
            tone: "gray",
            title: `${pendingInvites} invite${pendingInvites > 1 ? "s" : ""} awaiting acceptance`,
            detail: "Team members haven't joined yet",
            page: "team",
          });
        }
        if (canExport && expiringExports > 0) {
          attention.push({
            id: "exports",
            icon: Trash2,
            tone: "gray",
            title: `${expiringExports} export${expiringExports > 1 ? "s" : ""} expiring soon`,
            detail: "Data is scheduled to be purged within 7 days",
            page: "saveinfo",
          });
        }

        setFirstName(((profileRes.data as { full_name?: string } | null)?.full_name ?? "").trim().split(" ")[0] || null);
        setData({
          scheduled,
          stationCount: reqs.length,
          capacity,
          rollTotal,
          present,
          routesDone,
          routesInProgress,
          routesNotStarted,
          issuesToday,
          issuesWeek,
          attention,
        });
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load the dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = firstName ?? (isGuest ? "there" : null);

  return (
    <div className="mx-auto max-w-[1600px] p-8">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-black">
          {greeting}{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-gray-500">
          {format(new Date(), "EEEE, MMMM d")}
          {data ? ` · ${data.scheduled} scheduled · ${data.routesDone}/${data.rollTotal} routes done · ${data.issuesToday} issue${data.issuesToday === 1 ? "" : "s"} today` : ""}
        </p>
      </header>

      {isGuest && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-amber-900">You're browsing as a guest</p>
            <p className="mt-0.5 text-amber-800">
              Some features need a full account — including the{" "}
              <span className="font-medium">AI agent assistant</span> and{" "}
              <span className="font-medium">payroll setup</span>. Sign up to unlock
              them and keep your data saved.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <DashboardSkeleton />
      ) : (
        <BentoGrid className="auto-rows-[13rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {canSchedule && (
            <BentoCard
              name="Scheduled today"
              Icon={CalendarDays}
              description={`Across ${data!.stationCount} station${data!.stationCount === 1 ? "" : "s"} · ${data!.capacity} capacity`}
              cta="Open schedule"
              onClick={() => onNavigate("schedule")}
              background={<HeroNumber value={data!.scheduled} />}
            />
          )}
          {canReports && (
            <BentoCard
              name="Attendance"
              Icon={Users}
              description={
                data!.rollTotal === 0
                  ? "No roll call yet today"
                  : data!.present === data!.rollTotal
                    ? "Everyone present ✓"
                    : `${data!.rollTotal - data!.present} not present`
              }
              cta="View roll call"
              onClick={() => onNavigate("dailyreport")}
              background={<HeroNumber value={data!.rollTotal ? `${data!.present}/${data!.rollTotal}` : "—"} />}
            />
          )}
          {canReports && (
            <BentoCard
              name="Routes done"
              Icon={Truck}
              description={
                data!.rollTotal === 0
                  ? "No routes yet today"
                  : data!.routesDone === data!.rollTotal
                    ? "All routes completed ✓"
                    : `${data!.routesInProgress} in progress · ${data!.routesNotStarted} not started`
              }
              cta="View operations"
              onClick={() => onNavigate("dailyreport")}
              background={<HeroNumber value={data!.rollTotal ? `${data!.routesDone}/${data!.rollTotal}` : "—"} />}
            />
          )}
          {canReports && (
            <BentoCard
              name="Open issues"
              Icon={AlertTriangle}
              description={`${data!.issuesWeek} this week`}
              cta="View issues"
              onClick={() => onNavigate("dailyreport")}
              background={<HeroNumber value={data!.issuesToday} />}
            />
          )}

          <AttentionPanel items={data!.attention} onNavigate={onNavigate} />
        </BentoGrid>
      )}
    </div>
  );
}

/** Large stat shown in a card's background layer (top-right). */
function HeroNumber({ value }: { value: number | string }) {
  return (
    <span className="pointer-events-none absolute right-6 top-5 text-5xl font-bold tracking-tighter text-gray-900/90 tabular-nums">
      {value}
    </span>
  );
}

const PANEL_CHROME =
  "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]";

function AttentionPanel({
  items,
  onNavigate,
}: {
  items: AttentionItem[];
  onNavigate: (page: Page) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl p-6 sm:col-span-2 sm:row-span-2 lg:col-span-4",
        PANEL_CHROME,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Needs attention</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
          <p className="text-sm font-medium text-gray-900">You're all caught up</p>
          <p className="mt-1 text-sm text-gray-500">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.page)}
                className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 active:scale-[0.99]"
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", TONE[item.tone])}>
                  <item.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="truncate text-xs text-gray-500">{item.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <BentoGrid className="auto-rows-[13rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn("animate-pulse rounded-xl", PANEL_CHROME)} />
      ))}
      <div className={cn("animate-pulse rounded-xl sm:col-span-2 sm:row-span-2 lg:col-span-4", PANEL_CHROME)} />
    </BentoGrid>
  );
}
