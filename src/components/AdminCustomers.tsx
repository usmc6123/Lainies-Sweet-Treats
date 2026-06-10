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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-brand-rosegold" />
          <h2 className="text-xl font-bold text-brand-chocolate font-heading">
            Lainie's Sweet Friends (CRM)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Email/Client search */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full sm:w-60 text-xs bg-brand-cream/30 border border-brand-pink/15 rounded-xl pl-8 pr-3 py-2"
            />
          </div>

          <button
            onClick={() => setVipFilter(!vipFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
              vipFilter 
                ? "bg-brand-chocolate text-brand-cream" 
                : "bg-brand-pink/30 text-brand-chocolate hover:opacity-85"
            }`}
          >
            <Award className="h-3.5 w-3.5 text-yellow-300" />
            <span>VIP Spend Only (&gt;$250)</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-xs text-brand-chocolate/85">Loading sweet friend profiles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full bg-white border border-brand-pink/15 rounded-3xl p-16 text-center text-brand-chocolate/55 font-medium">
              No client files discovered matching specified filters.
            </div>
          ) : (
            filteredCustomers.map(c => {
              const isVip = c.totalSpent >= 250;
              return (
                <div
                  key={c.id}
                  className="bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-brand-pink/40 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-gray-400">CUSTOMER RECORD</span>
                        <h3 className="font-bold text-base text-brand-chocolate flex items-center gap-1">
                          <span>{c.name}</span>
                          {isVip && <Award className="h-4 w-4 text-brand-rosegold animate-pulse" />}
                        </h3>
                      </div>
                      
                      {isVip && (
                        <span className="text-[9px] bg-brand-pink/50 text-brand-chocolate rounded-sm px-2 py-0.5 font-bold uppercase">
                          VIP Sweets Lover
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-brand-chocolate/85">
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-brand-chocolate/40" />
                        <span>{c.email}</span>
                      </p>
                      {c.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-brand-chocolate/40" />
                          <span>{c.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-brand-pink/10 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Total Spent</span>
                      <strong className="text-brand-chocolate text-base block font-bold mt-0.5">
                        ${c.totalSpent.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Orders count</span>
                      <strong className="text-brand-rosegold text-base block font-bold mt-0.5">
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
