import React, { useState, useEffect } from "react";
import { Users, Search, Mail, Phone, Calendar, DollarSign, Award, ArrowUpRight, Check } from "lucide-react";
import { Customer } from "../types";

interface AdminCustomersProps {
  token: string;
}

export default function AdminCustomers({ token }: AdminCustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [vipFilter, setVipFilter] = useState(false);

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      try {
        const res = await fetch("/api/customers", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          setCustomers(await res.json());
        }
      } catch (err) {
        console.error("Failed to load customer profiles", err);
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, [token]);

  // Filter criteria
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery));
    
    if (vipFilter) {
      return matchesSearch && c.totalSpent >= 250; // Spend threshold for VIP treats status!
    }
    return matchesSearch;
  });

  return (
    <div id="admin-customers-tab" className="space-y-6 animate-in fade-in duration-300">
      
      {/* CRM header and tools */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-brand-rosegold" />
          <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
            Lainie's Sweet Friends (CRM)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Email/Client search */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full sm:w-64 text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
            />
          </div>

          <button
            onClick={() => setVipFilter(!vipFilter)}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              vipFilter 
                ? "bg-brand-chocolate text-brand-cream" 
                : "bg-brand-pink/30 text-brand-chocolate hover:opacity-85"
            }`}
          >
            <Award className="h-4 w-4 text-yellow-300" />
            <span>VIP Spend Only (&gt;$250)</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-sm text-brand-chocolate/85">Loading sweet friend profiles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full bg-white border border-brand-pink/15 rounded-3xl p-16 text-center text-brand-chocolate/60 font-semibold text-base">
              No client files discovered matching specified filters.
            </div>
          ) : (
            filteredCustomers.map(c => {
              const isVip = c.totalSpent >= 250;
              return (
                <div
                  key={c.id}
                  className="bg-white border border-brand-pink/20 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-brand-pink/40 transition-all duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-brand-rosegold">CUSTOMER RECORD</span>
                        <h3 className="font-extrabold text-lg text-brand-chocolate flex items-center gap-1.5 font-heading">
                          <span>{c.name}</span>
                          {isVip && <Award className="h-5 w-5 text-brand-rosegold animate-pulse" />}
                        </h3>
                      </div>
                      
                      {isVip && (
                        <span className="text-xs bg-brand-pink/50 text-brand-chocolate rounded-lg px-3 py-1 font-extrabold uppercase tracking-wide">
                          VIP Sweet Lover
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm font-semibold text-brand-chocolate/85">
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-brand-chocolate/40" />
                        <span>{c.email}</span>
                      </p>
                      {c.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-brand-chocolate/40" />
                          <span>{c.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-brand-pink/10 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block uppercase font-bold tracking-wider">Total Spent</span>
                      <strong className="text-brand-chocolate text-xl block font-extrabold mt-1">
                        ${c.totalSpent.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block uppercase font-bold tracking-wider">Orders Count</span>
                      <strong className="text-brand-rosegold text-xl block font-extrabold mt-1">
                        {c.orderCount} bakes
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
