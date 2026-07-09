import { Calendar, Users, CalendarOff, ClipboardList, Download, UserCog, LogOut } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../app/auth-context";

type Page = "schedule" | "contacts" | "timeoff" | "dailyreport" | "saveinfo" | "team";

interface SidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
  /** Go home to the main (schedule) page. */
  onLogoClick: () => void;
  /** Sign out of the app. */
  onSignOut: () => void;
}

export function Sidebar({ activePage, onPageChange, onLogoClick, onSignOut }: SidebarProps) {
  const { hasPermission } = useAuth();
  const canSave = hasPermission("reports.export");
  const canTeam =
    hasPermission("admin.invite") ||
    hasPermission("admin.permissions.edit") ||
    hasPermission("admin.users.remove");

  return (
    <div className="w-16 h-screen border-r border-gray-100 bg-white flex flex-col items-center pt-8 pb-6 gap-8 fixed left-0 top-0">
      <button
        onClick={onLogoClick}
        title="Home"
        aria-label="Go to the main schedule page"
        className="text-black font-bold text-3xl tracking-tighter mt-1.5 mb-6 transition-transform duration-150 ease-out hover:scale-105 active:scale-95 cursor-pointer"
      >
        VT
      </button>

      <nav className="flex flex-col gap-4">
        <button
          onClick={() => onPageChange("schedule")}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activePage === "schedule"
              ? "bg-black text-white shadow-lg"
              : "text-gray-400 hover:text-black hover:bg-gray-50",
          )}
          title="Master Schedule"
        >
          <Calendar size={20} />
          {activePage === "schedule" && (
            <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
          )}
        </button>

        <button
          onClick={() => onPageChange("dailyreport")}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activePage === "dailyreport"
              ? "bg-black text-white shadow-lg"
              : "text-gray-400 hover:text-black hover:bg-gray-50",
          )}
          title="Daily Report"
        >
          <ClipboardList size={20} />
          {activePage === "dailyreport" && (
            <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
          )}
        </button>

        <button
          onClick={() => onPageChange("timeoff")}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activePage === "timeoff"
              ? "bg-black text-white shadow-lg"
              : "text-gray-400 hover:text-black hover:bg-gray-50",
          )}
          title="Time Off & Exceptions"
        >
          <CalendarOff size={20} />
          {activePage === "timeoff" && (
            <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
          )}
        </button>

        <button
          onClick={() => onPageChange("contacts")}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activePage === "contacts"
              ? "bg-black text-white shadow-lg"
              : "text-gray-400 hover:text-black hover:bg-gray-50",
          )}
          title="Driver Contacts"
        >
          <Users size={20} />
          {activePage === "contacts" && (
            <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
          )}
        </button>

        {canSave && (
          <button
            onClick={() => onPageChange("saveinfo")}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 group relative",
              activePage === "saveinfo"
                ? "bg-black text-white shadow-lg"
                : "text-gray-400 hover:text-black hover:bg-gray-50",
            )}
            title="Save Information"
          >
            <Download size={20} />
            {activePage === "saveinfo" && (
              <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
            )}
          </button>
        )}

        {canTeam && (
          <button
            onClick={() => onPageChange("team")}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 group relative",
              activePage === "team"
                ? "bg-black text-white shadow-lg"
                : "text-gray-400 hover:text-black hover:bg-gray-50",
            )}
            title="Team & Access"
          >
            <UserCog size={20} />
            {activePage === "team" && (
              <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-1 h-4 bg-black rounded-full" />
            )}
          </button>
        )}
      </nav>

      <button
        onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="mt-auto p-3 rounded-xl text-gray-400 transition-all duration-200 hover:text-black hover:bg-gray-50 active:scale-95"
      >
        <LogOut size={20} />
      </button>
    </div>
  );
}
