import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { MasterSchedule } from '../components/schedule/MasterSchedule';
import { DriverContacts } from '../components/drivers/DriverContacts';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activePage, setActivePage] = useState<'schedule' | 'contacts'>(
    () => (localStorage.getItem('activePage') as 'schedule' | 'contacts') || 'schedule'
  );

  const handlePageChange = (page: 'schedule' | 'contacts') => {
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
            ) : (
              <DriverContacts />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
