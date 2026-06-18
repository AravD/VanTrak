import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { MasterSchedule } from '../components/schedule/MasterSchedule';
import { DriverContacts } from '../components/drivers/DriverContacts';
import { TimeOffExceptions } from '../components/timeoff/TimeOffExceptions';
import { DailyReport } from '../components/dailyreport/DailyReport';
import { SaveInformation } from '../components/saveinfo/SaveInformation';
import { AuthPage } from '../components/ui/auth-page';
import { motion, AnimatePresence } from 'motion/react';

type Page = 'schedule' | 'contacts' | 'timeoff' | 'dailyreport' | 'saveinfo';

export default function App() {
  const [activePage, setActivePage] = useState<Page>(
    () => (localStorage.getItem('activePage') as Page) || 'schedule'
  );

  // Landing/auth gate. Real authentication + role assignment will replace this
  // localStorage flag once multi-access roles are built.
  const [authed, setAuthed] = useState(
    () => localStorage.getItem('vt_authed') === 'true'
  );

  const handleAuthenticated = () => {
    localStorage.setItem('vt_authed', 'true');
    setAuthed(true);
  };

  const handleReturnToLanding = () => {
    localStorage.removeItem('vt_authed');
    setAuthed(false);
  };

  const handlePageChange = (page: Page) => {
    localStorage.setItem('activePage', page);
    setActivePage(page);
  };

  if (!authed) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans selection:bg-black selection:text-white">
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        onLogoClick={handleReturnToLanding}
      />
      
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
            ) : (
              <SaveInformation />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
