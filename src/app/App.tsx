import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { MasterSchedule } from '../components/schedule/MasterSchedule';
import { DriverContacts } from '../components/drivers/DriverContacts';
import { TimeOffExceptions } from '../components/timeoff/TimeOffExceptions';
import { motion, AnimatePresence } from 'motion/react';

type Page = 'schedule' | 'contacts' | 'timeoff';

export default function App() {
  const [activePage, setActivePage] = useState<Page>(
    () => (localStorage.getItem('activePage') as Page) || 'schedule'
  );

  const handlePageChange = (page: Page) => {
    localStorage.setItem('activePage', page);
    setActivePage(page);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans selection:bg-black selection:text-white">
      <Sidebar activePage={activePage} onPageChange={handlePageChange} />
      
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
            ) : (
              <TimeOffExceptions />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
