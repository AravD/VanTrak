import { useState } from "react";
import {
  Sidebar,
  SIDEBAR_ORDER,
  SIDEBAR_WIDTH,
  type SidebarState,
} from "../components/layout/Sidebar";
import { HomeDashboard } from "../components/home/HomeDashboard";
import { MasterSchedule } from "../components/schedule/MasterSchedule";
import { DriverContacts } from "../components/drivers/DriverContacts";
import { TimeOffExceptions } from "../components/timeoff/TimeOffExceptions";
import { DailyReport } from "../components/dailyreport/DailyReport";
import { Payroll } from "../components/payroll/Payroll";
import { SaveInformation } from "../components/saveinfo/SaveInformation";
import { TeamManagement } from "../components/team/TeamManagement";
import { MyAccount } from "../components/account/MyAccount";
import { RolePreviewSwitcher } from "../components/layout/RolePreviewSwitcher";
import { useAuth } from "./auth-context";
import { motion, AnimatePresence } from "motion/react";
import { MorphPanel } from "../components/ui/ai-input";

type Page =
  | "home"
  | "schedule"
  | "contacts"
  | "timeoff"
  | "dailyreport"
  | "payroll"
  | "saveinfo"
  | "team"
  | "account";

export function AppShell() {
  const { signOut, hasPermission } = useAuth();
  const canPayroll =
    hasPermission("payroll.view") || hasPermission("payroll.manage");

  const [activePage, setActivePage] = useState<Page>(() => {
    const lastPage = (localStorage.getItem("activePage") as Page) || "home";
    // A page reload keeps you where you were; only a fresh launch / sign-in
    // honors the "Default landing page" preference (defaults to Home).
    // sessionStorage survives reloads within a tab but is empty on a new sign-in.
    if (sessionStorage.getItem("vt_session_started")) return lastPage;
    sessionStorage.setItem("vt_session_started", "1");
    const landing = localStorage.getItem("vt_landing") || "home";
    return landing === "last" ? lastPage : (landing as Page);
  });

  const [dailyReportDate, setDailyReportDate] = useState<string | undefined>();

  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem("sidebarState");
    return saved === "icon" || saved === "compact" ? saved : "compact";
  });

  const handlePageChange = (page: Page, options?: { date?: string }) => {
    localStorage.setItem("activePage", page);
    setDailyReportDate(options?.date);
    setActivePage(page);
  };

  const cycleSidebar = () => {
    setSidebarState((prev) => {
      const next =
        SIDEBAR_ORDER[(SIDEBAR_ORDER.indexOf(prev) + 1) % SIDEBAR_ORDER.length];
      localStorage.setItem("sidebarState", next);
      return next;
    });
  };

  return (
    <div
      className="flex min-h-screen bg-[#FAFAFA] font-sans selection:bg-black selection:text-white"
      style={{ ["--sidebar-w" as string]: SIDEBAR_WIDTH[sidebarState] }}
    >
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        onLogoClick={() => handlePageChange("home")}
        onSignOut={signOut}
        state={sidebarState}
        onCycleState={cycleSidebar}
      />

      <RolePreviewSwitcher />
      <MorphPanel />

      <main
        className="flex-1 overflow-auto transition-[margin] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: "var(--sidebar-w)" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activePage === "home" ? (
              <HomeDashboard onNavigate={handlePageChange} />
            ) : activePage === "schedule" ? (
              <MasterSchedule />
            ) : activePage === "contacts" ? (
              <DriverContacts />
            ) : activePage === "timeoff" ? (
              <TimeOffExceptions />
            ) : activePage === "dailyreport" ? (
              <DailyReport initialDate={dailyReportDate} />
            ) : activePage === "payroll" ? (
              canPayroll ? (
                <Payroll onNavigate={handlePageChange} />
              ) : (
                <div className="mx-auto mt-24 max-w-sm px-8 text-center">
                  <h2 className="text-base font-semibold text-black">
                    You don't have access
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Viewing payroll requires the Payroll permission.
                  </p>
                </div>
              )
            ) : activePage === "team" ? (
              <TeamManagement />
            ) : activePage === "account" ? (
              <MyAccount />
            ) : hasPermission("reports.export") ? (
              <SaveInformation />
            ) : (
              <div className="mx-auto mt-24 max-w-sm px-8 text-center">
                <h2 className="text-base font-semibold text-black">
                  You don't have access
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Viewing and exporting saved information requires the Export
                  permission.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
