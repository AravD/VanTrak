import React from "react";
import { Calendar, Users } from "lucide-react";
import { cn } from "../../lib/utils";

interface SidebarProps {
  activePage: "schedule" | "contacts";
  onPageChange: (page: "schedule" | "contacts") => void;
}

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  return (
    <div className="w-16 h-screen border-r border-gray-100 bg-white flex flex-col items-center py-6 gap-8 fixed left-0 top-0">
      <div className="text-black font-bold text-xl tracking-tighter mb-4">
        VT
      </div>

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
      </nav>
    </div>
  );
}
