import React, { useState, useEffect } from "react";
import { TrendingUp, ShoppingBag, DollarSign, Clock, Users, ArrowUpRight, Calendar, Sparkles, FolderSync, PlusCircle } from "lucide-react";
import { Order, Quote } from "../types";

interface AdminDashboardProps {
  token: string;
  setView: (v: string) => void;
  triggerRefresh: number;
}

export default function AdminDashboard({ token, setView, triggerRefresh }: AdminDashboardProps) {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [aRes, oRes] = await Promise.all([
          fetch("/api/analytics", {
            headers: { "Authorization": `Bearer ${token}` }
          }),
          fetch("/api/orders", {
            headers: { "Authorization": `Bearer ${token}` }
          })
        ]);

        if (aRes.ok) setAnalytics(await aRes.ok ? await aRes.json() : null);
        if (oRes.ok) {
          const orders = await oRes.json();
          // Sort items by orderDate descending
          orders.sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
          setRecentOrders(orders.slice(0, 5)); // top 5
        }
      } catch (err) {
        console.error("Failed to load admin analytics or orders details", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [token, triggerRefresh]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
        <p className="mt-3 text-xs text-brand-chocolate/70">Analyzing baker sheets...</p>
      </div>
    );
  }

  const overview = analytics?.overview || {
    totalRevenue: 0,
    averageOrderValue: 0,
    returnRate: 0,
    activeOrders: 0,
    totalOrdersCount: 0,
    totalCustomersCount: 0
  };

  return (
    <div id="admin-dashboard" className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-brand-rosegold/10 rounded-[2.5rem] p-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-brand-chocolate font-heading italic">
            Good day, <span className="text-brand-rosegold">Lainie!</span> 🍰
          </h2>
          <p className="text-xs text-brand-chocolate/75 mt-0.5">
            Royse City sweet lovers have booked some exciting celebrations this season.
          </p>
        </div>
        
        {/* Quick action shortcuts */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("admin-calendar")}
            className="px-5 py-2.5 bg-brand-chocolate text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:opacity-90 transition-all duration-200"
          >
            <span className="flex items-center gap-1.5 justify-center"><Calendar className="h-3.5 w-3.5" /> View Calendar</span>
          </button>
          <button
            onClick={() => setView("admin-quotes")}
            className="px-5 py-2.5 bg-brand-rosegold text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:opacity-90 transition-all duration-200 shadow-[0_4px_14px_rgba(183,110,121,0.3)]"
          >
            <span className="flex items-center gap-1.5 justify-center"><Sparkles className="h-3.5 w-3.5" /> Process Quotes</span>
          </button>
        </div>
      </div>

      {/* STATS TILES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center border border-brand-rosegold/10">
          <span className="text-[11px] uppercase tracking-widest text-[#B76E79] mb-1 font-semibold">Cumulative Revenue</span>
          <h3 className="text-3xl font-bold font-heading text-brand-chocolate">
            ${overview.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-0.5 mt-1">
            <TrendingUp className="h-3 w-3" />
            <span>Full Historical</span>
          </p>
        </div>

        {/* Card 2: Active Orders */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center border border-brand-rosegold/10">
          <span className="text-[11px] uppercase tracking-widest text-[#B76E79] mb-1 font-semibold">Active Orders</span>
          <h3 className="text-3xl font-bold font-heading text-brand-rosegold">
            {overview.activeOrders} active
          </h3>
          <p className="text-[10px] text-brand-chocolate/60 uppercase font-semibold tracking-wider mt-1">
            Total Filed: {overview.totalOrdersCount}
          </p>
        </div>

        {/* Card 3: Ticket Size */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center border border-brand-rosegold/10">
          <span className="text-[11px] uppercase tracking-widest text-[#B76E79] mb-1 font-semibold">Average Ticket Size</span>
          <h3 className="text-3xl font-bold font-heading text-brand-chocolate">
            ${overview.averageOrderValue.toFixed(0)}
          </h3>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1">
            In Royse City
          </p>
        </div>

        {/* Card 4: Return Rate */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center border border-brand-rosegold/10">
          <span className="text-[11px] uppercase tracking-widest text-[#B76E79] mb-1 font-semibold">Return Rate</span>
          <h3 className="text-3xl font-bold font-heading text-brand-chocolate">
            {overview.returnRate.toFixed(1)}%
          </h3>
          <p className="text-[10px] text-brand-chocolate/60 uppercase font-semibold tracking-wider mt-1">
            {overview.totalCustomersCount} Sweet Friends
          </p>
        </div>
      </div>

      {/* RECENT ACTIVITY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent incoming Orders flow */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-brand-rosegold/10">
          <div className="flex items-center justify-between pb-4 border-b border-brand-pink/20 mb-6">
            <h3 className="text-xl italic font-medium font-heading text-brand-chocolate flex items-center space-x-1.5">
              <span>Recent Activity Feed</span>
            </h3>
            <button
              onClick={() => setView("admin-orders")}
              className="text-xs text-brand-rosegold font-semibold uppercase tracking-wider hover:opacity-80 transition"
            >
              View All
            </button>
          </div>

          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-xs text-brand-chocolate/50 py-10 text-center italic">No orders filed yet.</p>
            ) : (
              recentOrders.map(o => (
                <div 
                  key={o.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-brand-cream border border-brand-pink/10 transition-all hover:shadow-xs"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-pink/50 flex items-center justify-center text-lg shadow-xs shrink-0">
                      {o.type.includes("Cake") ? "🍰" : o.type.includes("Cupcake") ? "🧁" : "🍪"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-chocolate">{o.customerName}</p>
                      <p className="text-xs text-gray-500 font-medium">Fulfillment Date: {o.fulfillmentDate}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${
                      o.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                      o.status === "Confirmed" ? "bg-blue-100 text-blue-800" :
                      o.status === "Ready" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                    }`}>
                      {o.status}
                    </span>
                    <p className="text-sm font-bold mt-1 text-brand-chocolate">${o.total.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick helper instructions & status summary */}
        <div className="bg-brand-pink rounded-[2.5rem] p-8 shadow-inner flex flex-col justify-between border border-brand-pink/40 text-brand-chocolate">
          <div className="space-y-4">
            <h3 className="text-xl italic font-medium font-heading flex items-center space-x-1.5 text-brand-chocolate">
              <FolderSync className="h-5 w-5 text-brand-rosegold" />
              <span>Quick Insights</span>
            </h3>
            
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-rosegold mb-2">
              Bake Shop Workflow
            </p>

            <ul className="space-y-4 text-xs text-brand-chocolate/90">
              <li className="flex items-start space-x-2">
                <span className="bg-brand-chocolate text-white h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                <span>Review **Pending Orders** directly from the core Orders Spreadsheet to trigger Confirmed state.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="bg-brand-chocolate text-white h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                <span>Refine custom itemizations and totals on **Bespoke Estimates** dynamically.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="bg-brand-chocolate text-white h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                <span>Configure absolute customer limits on custom days in **Calendar Limits**.</span>
              </li>
            </ul>
          </div>

          <div className="pt-6 border-t border-white/40 mt-8">
            <div className="bg-white/40 p-4 rounded-2xl border border-white/50 text-xs text-brand-chocolate/80">
              <p className="font-bold uppercase tracking-wider text-[10px] mb-1.5 text-brand-rosegold">Most Popular This Week</p>
              <div className="flex items-center justify-between font-semibold">
                <span>Custom Mini Cakes</span>
                <span className="text-xs px-2 py-0.5 rounded bg-white text-brand-chocolate">8 Booked</span>
              </div>
            </div>
            <p className="text-[10px] text-center mt-4 text-brand-chocolate/60">
              Royse City, TX • Active Admin Session
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
