import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  CalendarOff,
  ClipboardList,
  Wallet,
  Download,
  UserCog,
  LogOut,
  ChevronsLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../app/auth-context";

type Page = "home" | "schedule" | "contacts" | "timeoff" | "dailyreport" | "payroll" | "saveinfo" | "team" | "account";

/** The two widths the sidebar toggles between when the edge arrow is clicked. */
export type SidebarState = "compact" | "icon";

/** Toggle order: medium ⇄ icons-only. */
export const SIDEBAR_ORDER: SidebarState[] = ["compact", "icon"];

/** Rendered widths per state (also exposed to the shell so content can offset). */
export const SIDEBAR_WIDTH: Record<SidebarState, string> = {
  compact: "13rem", // 208px — medium
  icon: "4rem", // 64px — original rail
};

interface NavItem {
  page: Page;
  /** Short label shown next to the icon in full/compact. */
  label: string;
  /** Full descriptive name — used for tooltips, titles and screen readers. */
  full: string;
  icon: LucideIcon;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

interface SidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  /** Go home to the main (schedule) page. */
  onLogoClick: () => void;
  /** Sign out of the app. */
  onSignOut: () => void;
  /** Current collapse state (owned by the shell so it can offset the content). */
  state: SidebarState;
  /** Advance to the next collapse state. */
  onCycleState: () => void;
}

export function Sidebar({
  activePage,
  onPageChange,
  onLogoClick,
  onSignOut,
  state,
  onCycleState,
}: SidebarProps) {
  const { hasPermission, session, isGuest, membership } = useAuth();

  const canSave = hasPermission("reports.export");
  const canTeam =
    hasPermission("admin.invite") ||
    hasPermission("admin.permissions.edit") ||
    hasPermission("admin.users.remove");
  const canPayroll =
    hasPermission("payroll.view") || hasPermission("payroll.manage");

  const iconOnly = state === "icon";

  const sections: NavSection[] = [
    {
      heading: "Overview",
      items: [{ page: "home" as Page, label: "Home", full: "Home", icon: LayoutDashboard }],
    },
    {
      heading: "Operations",
      items: [
        { page: "schedule" as Page, label: "Schedule", full: "Master Schedule", icon: Calendar },
        { page: "dailyreport" as Page, label: "Daily Report", full: "Daily Report", icon: ClipboardList },
        { page: "timeoff" as Page, label: "Time Off", full: "Time Off & Exceptions", icon: CalendarOff },
        { page: "contacts" as Page, label: "Drivers", full: "Driver Contacts", icon: Users },
        ...(canPayroll
          ? [{ page: "payroll" as Page, label: "Payroll", full: "Payroll", icon: Wallet }]
          : []),
      ],
    },
    {
      heading: "Administration",
      items: [
        ...(canTeam
          ? [{ page: "team" as Page, label: "Team", full: "Team & Access", icon: UserCog }]
          : []),
        ...(canSave
          ? [{ page: "saveinfo" as Page, label: "Save Info", full: "Save Information", icon: Download }]
          : []),
      ],
    },
  ].filter((s) => s.items.length > 0);

  // Footer identity — prefer the user's full name (from their profile), falling
  // back to email. Refetches when the profile is edited (My Account dispatches
  // the `vt:profile-updated` event).
  const email = session?.user.email ?? null;
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setFullName(null);
      return;
    }
    let active = true;
    const loadName = () =>
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setFullName((data?.full_name ?? "").trim() || null);
        });
    loadName();
    window.addEventListener("vt:profile-updated", loadName);
    return () => {
      active = false;
      window.removeEventListener("vt:profile-updated", loadName);
    };
  }, [session?.user.id]);

  const primary = isGuest ? "Guest" : fullName ?? email ?? "Signed in";
  const secondary = isGuest ? "Guest access" : membership?.roleName ?? "Member";
  const initials = (isGuest ? "G" : (fullName ?? email ?? "?")[0] ?? "?").toUpperCase();

  return (
    <aside
      style={{ width: SIDEBAR_WIDTH[state] }}
      className="fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-gray-100 bg-white transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
    >
      {/* Brand — big "VT" wordmark, left-aligned with the nav column */}
      <button
        onClick={onLogoClick}
        title="Home"
        aria-label="Go to the main schedule page"
        // Constant px keeps the VT pinned (and ~centered in the 64px rail) so it
        // never moves between states. pt tuned to sit on the page-title baseline.
        className="flex shrink-0 flex-col items-start px-4 pb-6 pt-11 transition-all duration-500 active:scale-[0.98]"
      >
        <span className="text-3xl font-bold leading-none tracking-tighter text-black">VT</span>
      </button>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-2.5 pb-4">
        {sections.map((section) => (
          <div key={section.heading}>
            {/* Stays mounted in icon mode (just faded) so its height is reserved
                and the nav rows don't jump while the sidebar collapses. */}
            <p
              className={cn(
                "mb-2 truncate px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition-opacity duration-500",
                iconOnly ? "opacity-0" : "opacity-100",
              )}
            >
              {section.heading}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavRow
                  key={item.page}
                  icon={item.icon}
                  label={item.label}
                  full={item.full}
                  active={activePage === item.page}
                  iconOnly={iconOnly}
                  onClick={() => onPageChange(item.page)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle — full-width row, chevron rotates between states */}
      <div className="shrink-0 border-t border-gray-100 px-2.5 py-3">
        <button
          onClick={onCycleState}
          title={iconOnly ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={iconOnly ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center justify-start rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors duration-200 hover:bg-gray-50 hover:text-black"
        >
          <ChevronsLeft
            size={20}
            className={cn(
              "shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
              iconOnly && "rotate-180",
            )}
          />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-500",
              iconOnly ? "ml-0 max-w-0 -translate-x-2 opacity-0" : "ml-3 max-w-[150px] translate-x-0 opacity-100",
            )}
          >
            Collapse
          </span>
        </button>
      </div>

      {/* User — opens My Account; sign out below */}
      <div className="shrink-0 space-y-1 border-t border-gray-100 px-2.5 py-3">
        <button
          type="button"
          onClick={() => onPageChange("account")}
          title={iconOnly ? "My Account" : undefined}
          aria-label="My Account"
          aria-current={activePage === "account" ? "page" : undefined}
          className={cn(
            "group relative flex w-full items-center rounded-xl px-2 py-2 text-left transition-colors",
            activePage === "account" ? "bg-gray-100" : "hover:bg-gray-50",
          )}
        >
          <div
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
              activePage === "account" ? "bg-black text-white" : "bg-gray-100 text-gray-600",
            )}
          >
            {initials}
          </div>
          <div
            className={cn(
              "overflow-hidden text-left leading-tight transition-all duration-500",
              iconOnly ? "ml-0 max-w-0 -translate-x-2 opacity-0" : "ml-3 max-w-[150px] translate-x-0 opacity-100",
            )}
          >
            <p className="truncate text-sm font-medium text-black">{primary}</p>
            <p className="truncate text-[11px] capitalize text-gray-400">{secondary}</p>
          </div>
          {iconOnly && <Tooltip label="My Account" />}
        </button>

        <NavRow
          icon={LogOut}
          label="Sign out"
          full="Sign out"
          active={false}
          iconOnly={iconOnly}
          onClick={onSignOut}
        />
      </div>
    </aside>
  );
}

interface NavRowProps {
  icon: LucideIcon;
  label: string;
  full: string;
  active: boolean;
  iconOnly: boolean;
  onClick: () => void;
}

function NavRow({ icon: Icon, label, full, active, iconOnly, onClick }: NavRowProps) {
  return (
    <button
      onClick={onClick}
      title={iconOnly ? full : undefined}
      aria-label={full}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Constant px keeps the icon pinned (and centered in the 64px rail) so it
        // never moves between states — only the label collapses beside it.
        "group relative flex w-full items-center justify-start rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-black text-white shadow-sm"
          : "text-gray-400 hover:bg-gray-50 hover:text-black",
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-500",
          iconOnly ? "ml-0 max-w-0 -translate-x-2 opacity-0" : "ml-3 max-w-[150px] translate-x-0 opacity-100",
        )}
      >
        {label}
      </span>
      {iconOnly && <Tooltip label={full} />}
    </button>
  );
}

/** Hover tooltip shown only in icons-only mode. */
function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-40 ml-2 -translate-x-1 whitespace-nowrap rounded-md bg-black px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100">
      {label}
    </span>
  );
}
