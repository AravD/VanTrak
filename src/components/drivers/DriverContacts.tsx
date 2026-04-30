import React, { useState, useEffect, ChangeEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Driver } from "../../types/driver";
import { Edit2, Plus, Trash2, Mail, Phone, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function DriverContacts() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("first_name", { ascending: true });

    if (error) console.error("Error fetching drivers:", error);
    else setDrivers(data || []);
  };

  const handleDeleteDriver = async (driverId: string) => {
    console.log("handleDeleteDriver called with ID:", driverId);

    try {
      if (!supabase) {
        console.error("Supabase client is not initialized.");
        return;
      }

      console.log("Executing Supabase delete request...");
      const { data, error, status, statusText } = await supabase
        .from("drivers")
        .delete()
        .eq("id", driverId)
        .select();

      if (error) {
        console.error("Supabase delete error:", error);
        alert(`Supabase error: ${error.message}`);
        return;
      }

      console.log("Supabase response status:", status, statusText);
      console.log("Supabase deletion result data:", data);

      if (data && data.length > 0) {
        console.log("Driver successfully removed from database.");
        setDrivers((prev) => prev.filter((d) => d.id !== driverId));
        setIsModalOpen(false);
      } else {
        console.warn(
          "No rows were deleted. This could mean the ID wasn't found or RLS policies are blocking the deletion.",
        );
        alert(
          "Deletion failed: No record found or permission denied on Supabase. Please check your RLS policies.",
        );
      }
    } catch (err) {
      console.error("Unexpected error during deletion:", err);
    }
  };

  const statusColors = {
    Active: "bg-green-100 text-green-700 border-green-200",
    Probation: "bg-orange-100 text-orange-700 border-orange-200",
    "W/C": "bg-purple-100 text-purple-700 border-purple-200",
    Inactive: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="p-8 max-w-[1400px]">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Driver Contacts
          </h1>
        </div>

        <button
          onClick={() => {
            setEditingDriver(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
        >
          <Plus size={20} />
          Add New Driver
        </button>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
              <th className="px-6 py-4 w-12 text-center">#</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Schedule</th>
              <th className="px-6 py-4">Notes</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {drivers.map((driver, index) => (
              <tr
                key={driver.id}
                onClick={() => {
                  setEditingDriver(driver);
                  setIsModalOpen(true);
                }}
                className="hover:bg-gray-50/30 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4 text-center">
                  <span className="text-[10px] font-bold text-gray-400 font-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-black">
                    {driver.first_name} {driver.last_name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="opacity-50" />{" "}
                      {driver.phone || "No number"}
                    </div>
                    {driver.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="opacity-50" /> {driver.email}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map(
                      (day) =>
                        driver[day as keyof Driver] && (
                          <span
                            key={day}
                            className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter bg-gray-100 px-1.5 py-0.5 rounded"
                          >
                            {day}
                          </span>
                        ),
                    )}
                    {!["sun", "mon", "tue", "wed", "thu", "fri", "sat"].some(
                      (d) => driver[d as keyof Driver],
                    ) && (
                      <span className="text-[10px] text-gray-300 italic font-medium">
                        No days set
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div
                    className="text-xs text-gray-500 max-w-[200px] truncate"
                    title={driver.notes || ""}
                  >
                    {driver.notes || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter",
                      statusColors[driver.status as keyof typeof statusColors],
                    )}
                  >
                    {driver.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {drivers.length === 0 && (
          <div className="py-20 text-center text-gray-400 italic">
            No drivers found. Add your first driver to get started.
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <DriverModal
            onClose={() => setIsModalOpen(false)}
            onSave={() => {
              setIsModalOpen(false);
              fetchDrivers();
            }}
            onDelete={handleDeleteDriver}
            driver={editingDriver}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Internal Modal Component for Cleanliness
function DriverModal({
  onClose,
  onSave,
  onDelete,
  driver,
}: {
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: string) => Promise<void>;
  driver: Driver | null;
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [formData, setFormData] = useState<Partial<Driver>>(
    driver || {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      status: "Active",
      van_number: "",
      notes: "",
      sun: false,
      mon: false,
      tue: false,
      wed: false,
      thu: false,
      fri: false,
      sat: false,
    },
  );

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const limited = digits.slice(0, 10);

    if (limited.length === 0) return "";
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6)
      return `(${limited.slice(0, 3)})-${limited.slice(3)}`;
    return `(${limited.slice(0, 3)})-${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const save = async () => {
    // Basic validation
    if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
      setStatusMessage({
        type: "error",
        text: "First and Last name are required.",
      });
      return;
    }

    if (!formData.email?.trim() && !formData.phone?.trim()) {
      setStatusMessage({
        type: "error",
        text: "A valid Phone Number or Email is required.",
      });
      return;
    }

    setStatusMessage(null);
    setIsSaving(true);

    try {
      if (driver?.id) {
        const { error } = await supabase
          .from("drivers")
          .update(formData)
          .eq("id", driver.id);
        if (error) setStatusMessage({ type: "error", text: error.message });
        else onSave();
      } else {
        const { error } = await supabase.from("drivers").insert([formData]);
        if (error) setStatusMessage({ type: "error", text: error.message });
        else onSave();
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "An unexpected error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    console.log("Remove button clicked in modal. Driver ID:", driver?.id);
    setStatusMessage(null);
    if (driver?.id) {
      try {
        await onDelete(driver.id);
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: err.message || "Failed to delete driver",
        });
      }
    }
  };

  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8 overflow-hidden"
      >
        <h2 className="text-2xl font-bold mb-6 tracking-tight">
          {driver ? "Edit Driver" : "Add New Driver"}
        </h2>

        {statusMessage && (
          <div
            className={cn(
              "p-3 rounded-xl mb-6 text-sm font-medium",
              statusMessage.type === "error"
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-green-50 text-green-600 border border-green-100",
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              First Name
            </label>
            <input
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Last Name
            </label>
            <input
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            >
              <option>Active</option>
              <option>Probation</option>
              <option>W/C</option>
              <option>Inactive</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Van #
            </label>
            <input
              value={formData.van_number || ""}
              onChange={(e) =>
                setFormData({ ...formData, van_number: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Email Address
            </label>
            <input
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Phone Number
            </label>
            <input
              value={formData.phone || ""}
              onChange={handlePhoneChange}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Notes / Remarks
              </label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    notes: formData.notes
                      ? `${formData.notes}\nRescue Ready`.trim()
                      : "Rescue Ready",
                  })
                }
                className="text-[10px] font-bold text-blue-500 hover:text-blue-600 bg-blue-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                + Rescue Ready
              </button>
            </div>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5 resize-none text-sm"
              placeholder=""
            />
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Base Schedule (Weekly Availability)
          </label>
          <div className="flex justify-between">
            {days.map((day) => (
              <button
                key={day}
                onClick={() =>
                  setFormData({ ...formData, [day]: !formData[day] })
                }
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                  formData[day]
                    ? "bg-black text-white border-black shadow-lg shadow-black/10"
                    : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200",
                )}
              >
                {day.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {isConfirmingDelete ? (
            <>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
              >
                Confirm Delete
              </button>
            </>
          ) : (
            <>
              {driver && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-4 py-3 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center group"
                  title="Delete Driver"
                >
                  <Trash2
                    size={20}
                    className="group-hover:scale-110 transition-transform"
                  />
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className={cn(
                  "flex-1 px-6 py-3 rounded-xl bg-black text-white font-bold transition-all shadow-lg shadow-gray-200",
                  isSaving
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-800",
                )}
              >
                {isSaving ? "Saving..." : "Save Driver"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
