import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Lock, Unlock, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Order } from "../types";

interface AdminCalendarProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminCalendar({ token, triggerRefresh }: AdminCalendarProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [blockedDates, setBlockedDates] = useState<{ date: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Controls for blocking/unblocking dates
  const [blockDateStr, setBlockDateStr] = useState("");
  const [blockReasonStr, setBlockReasonStr] = useState("");
  const [blockMessage, setBlockMessage] = useState("");

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [ordRes, blRes] = await Promise.all([
        fetch("/api/orders", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("/api/blocked-dates")
      ]);
      if (ordRes.ok) setOrders(await ordRes.json());
      if (blRes.ok) setBlockedDates(await blRes.json());
    } catch (err) {
      console.error("Failed to load scheduler resources", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [token]);

  const handleBlockDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDateStr) return;
    setBlockMessage("");

    try {
      const res = await fetch("/api/blocked-dates", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ date: blockDateStr, reason: blockReasonStr || "Bakery Closed / Unavailable" })
      });
      if (res.ok) {
        setBlockedDates([...blockedDates, { date: blockDateStr, reason: blockReasonStr || "Bakery Closed / Unavailable" }]);
        setBlockDateStr("");
        setBlockReasonStr("");
        triggerRefresh();
        setBlockMessage("Successfully marked requested date as fully closed!");
      } else {
        const errorData = await res.json();
        setBlockMessage(errorData.error || "Failed to block date.");
      }
    } catch {
      setBlockMessage("Error communicating with calendar backend.");
    }
  };

  const handleUnblockDate = async (dateStr: string) => {
    if (!confirm(`Are you sure you want to re-open ${dateStr} for client order submissions?`)) return;
    try {
      const res = await fetch(`/api/blocked-dates/${dateStr}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setBlockedDates(blockedDates.filter(b => b.date !== dateStr));
        triggerRefresh();
      }
    } catch {
      alert("Error unblocking calendar date.");
    }
  };

  // GENERATE CALENDAR GRID DATES
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month fill-ins
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevMonthDays - i).padStart(2, "0")}`;
    calendarDays.push({ dateStr: dStr, dayNum: prevMonthDays - i, isCurrentMonth: false });
  }

  // Active month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    calendarDays.push({ dateStr: dStr, dayNum: i, isCurrentMonth: true });
  }

  // Next month padding
  const totalSlots = 42; // 6 rows of 7 days
  const remainingSlots = totalSlots - calendarDays.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    calendarDays.push({ dateStr: dStr, dayNum: i, isCurrentMonth: false });
  }

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const getDayMetrics = (dateStr: string) => {
    const matchedOrders = orders.filter(o => o.fulfillmentDate === dateStr && o.status !== "Cancelled");
    const isBlocked = blockedDates.some(b => b.date === dateStr);
    const blockedReason = blockedDates.find(b => b.date === dateStr)?.reason || "";
    
    return {
      orderCount: matchedOrders.length,
      orders: matchedOrders,
      isBlocked,
      blockedReason
    };
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div id="admin-calendar-tab" className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main interactive calendar sheet (takes 2/3 coordinates) */}
        <div className="lg:col-span-2 bg-white border border-brand-pink/20 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-brand-pink/10">
            <h3 className="text-base font-bold text-brand-chocolate flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-brand-rosegold" />
              <span>{monthNames[month]} {year} Scheduler</span>
            </h3>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigateMonth("prev")}
                className="p-1.5 hover:bg-brand-pink/30 rounded-lg text-brand-chocolate transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-[10px] uppercase font-bold text-brand-rosegold bg-brand-pink/10 rounded-sm hover:opacity-80 transition"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth("next")}
                className="p-1.5 hover:bg-brand-pink/30 rounded-lg text-brand-chocolate transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Calendar weekdays legend */}
          <div className="grid grid-cols-7 text-center text-[10px] uppercase font-bold text-gray-400">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((slot, index) => {
              const { orderCount, isBlocked } = getDayMetrics(slot.dateStr);
              // limit criteria: limit is 10. warning if count >= 7. Full if >= 10.
              const isFull = orderCount >= 10;
              const isBusy = orderCount >= 5 && orderCount < 10;

              return (
                <div
                  key={index}
                  className={`min-h-[55px] p-1.5 border rounded-xl flex flex-col justify-between transition-all relative group ${
                    slot.isCurrentMonth ? "bg-white border-brand-pink/10" : "bg-gray-50/50 border-gray-100 opacity-40"
                  } ${
                    isBlocked ? "bg-red-50/30 border-red-150 text-red-800" : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-[11px] font-bold ${isBlocked ? "text-red-600 line-through" : "text-brand-chocolate"}`}>
                      {slot.dayNum}
                    </span>
                    {isBlocked && (
                      <span className="text-[8px] bg-red-600 text-white rounded-sm px-1 leading-normal font-bold">Closed</span>
                    )}
                  </div>

                  {/* Indicators */}
                  <div className="space-y-1">
                    {orderCount > 0 && (
                      <div className={`text-[8.5px] font-bold rounded-md px-1.5 py-0.5 leading-none text-center ${
                        isFull ? "bg-red-100 text-red-800" :
                        isBusy ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {orderCount} Cakes
                      </div>
                    )}
                  </div>

                  {/* hover info tooltip */}
                  <div className="hidden group-hover:block absolute bg-brand-chocolate text-brand-cream text-[10px] p-2 rounded-lg z-20 shadow-lg -top-12 left-1/2 -translate-x-1/2 w-40 pointer-events-none text-center">
                    <p className="font-semibold">{slot.dateStr}</p>
                    <p className="mt-0.5">
                      {isBlocked ? "CLOSED: Custom Block" : `${orderCount}/10 Order Limit Filled`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color coding legend */}
          <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-gray-500 pt-3 border-t border-brand-pink/10 justify-center">
            <span className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 bg-blue-100 text-blue-800 inline-block rounded-full"></span>
              <span>Light Load (&lt;5)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 bg-amber-100 text-amber-800 inline-block rounded-full"></span>
              <span>Moderate Workload (5-9)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 bg-red-100 text-red-800 inline-block rounded-full"></span>
              <span>Limit Fully Occupied (10)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 bg-red-600 inline-block rounded-full"></span>
              <span>Bake Shop Closed</span>
            </span>
          </div>
        </div>

        {/* Blocking out Calendar elements controls (takes 1/3) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-brand-pink/20 rounded-3xl p-5 shadow-xs">
            <h4 className="text-sm font-bold text-brand-chocolate flex items-center space-x-1.5 pb-3 border-b border-brand-pink/10">
              <Lock className="h-4.5 w-4.5 text-red-600" />
              <span>Block Out Holidays</span>
            </h4>
            <p className="text-[11px] text-gray-500 my-3 leading-relaxed">
              Block out personal holidays, market dates, or peak weeks to fully close self-order quote submissions for those specific dates.
            </p>

            <form onSubmit={handleBlockDate} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-brand-chocolate/50 block">Target Close Date</label>
                <input
                  type="date"
                  required
                  value={blockDateStr}
                  onChange={(e) => setBlockDateStr(e.target.value)}
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl px-3 py-2.5 mt-1 focus:none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-brand-chocolate/50 block">Reason of Closure</label>
                <input
                  type="text"
                  required
                  value={blockReasonStr}
                  onChange={(e) => setBlockReasonStr(e.target.value)}
                  placeholder="Christmas Holiday Break / Closed"
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl px-3 py-2.5 mt-1 focus:none"
                />
              </div>

              {blockMessage && (
                <p className="p-2.5 bg-yellow-50 text-brand-chocolate border border-yellow-100 rounded-xl text-[10px] font-semibold text-center">
                  💡 {blockMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 shadow-xs"
              >
                <Lock className="h-3.5 w-3.5 text-brand-pink" />
                <span>Enforce Closure Block Date</span>
              </button>
            </form>
          </div>

          {/* List of blocked dates */}
          <div className="bg-white border border-brand-pink/20 rounded-3xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-chocolate/60">
              Active Closures ({blockedDates.length})
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {blockedDates.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic text-center py-4">No vacation dates currently disabled.</p>
              ) : (
                blockedDates.map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 bg-red-50/20 hover:bg-red-50/40 rounded-xl border border-red-100 text-xs">
                    <div>
                      <p className="font-bold text-red-800">{b.date}</p>
                      <p className="text-[10px] text-gray-500 font-medium leading-tight">{b.reason}</p>
                    </div>
                    <button
                      onClick={() => handleUnblockDate(b.date)}
                      className="text-red-600 hover:text-red-800 p-1 font-bold text-[11px]"
                    >
                      Unlock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
