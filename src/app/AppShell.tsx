import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { MasterSchedule } from '../components/schedule/MasterSchedule';
import { DriverContacts } from '../components/drivers/DriverContacts';
import { TimeOffExceptions } from '../components/timeoff/TimeOffExceptions';
import { DailyReport } from '../components/dailyreport/DailyReport';
import { SaveInformation } from '../components/saveinfo/SaveInformation';
import { TeamManagement } from '../components/team/TeamManagement';
import { RolePreviewSwitcher } from '../components/layout/RolePreviewSwitcher';
import { useAuth } from './auth-context';
import { motion, AnimatePresence } from 'motion/react';

type Page = 'schedule' | 'contacts' | 'timeoff' | 'dailyreport' | 'saveinfo' | 'team';

export function AppShell() {
  const { signOut, hasPermission } = useAuth();

  const [activePage, setActivePage] = useState<Page>(
    () => (localStorage.getItem('activePage') as Page) || 'schedule'
  );

  const handlePageChange = (page: Page) => {
    localStorage.setItem('activePage', page);
    setActivePage(page);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans selection:bg-black selection:text-white">
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        onLogoClick={signOut}
      />

      <RolePreviewSwitcher />

      <main className="flex-1 ml-16 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activePage === 'schedule' ? (
              <MasterSchedule />
            ) : activePage === 'contacts' ? (
              <DriverContacts />
            ) : activePage === 'timeoff' ? (
              <TimeOffExceptions />
            ) : activePage === 'dailyreport' ? (
              <DailyReport />
            ) : activePage === 'team' ? (
              <TeamManagement />
            ) : hasPermission('reports.export') ? (
              <SaveInformation />
            ) : (
              <div className="mx-auto mt-24 max-w-sm px-8 text-center">
                <h2 className="text-base font-semibold text-black">You don't have access</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Viewing and exporting saved information requires the Export permission.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
