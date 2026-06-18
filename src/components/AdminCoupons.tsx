import React, { useState, useEffect } from "react";
import { Ticket, Search, PlusCircle, Trash2, ToggleLeft, ToggleRight, Calendar, Sparkles, DollarSign, Percent, Info } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  value: number;
  minOrderAmount: number;
  expiryDate: string;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
}

interface AdminCouponsProps {
  token: string;
  triggerRefresh?: () => void;
}

export default function AdminCoupons({ token, triggerRefresh }: AdminCouponsProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState<number>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize expiry date to 30 days out
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setExpiryDate(d.toISOString().slice(0, 10));
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coupons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setCoupons(await res.json());
      }
    } catch (err) {
      console.error("Failed to load discount coupons", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [token]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!code.trim()) {
      setFormError("Coupon code is required");
      setSubmitting(false);
      return;
    }

    if (value <= 0) {
      setFormError("Discount value must be greater than zero");
      setSubmitting(false);
      return;
    }

    if (discountType === "percentage" && value > 100) {
      setFormError("Percentage discount cannot exceed 100%");
      setSubmitting(false);
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      discountType,
      value: Number(value),
      minOrderAmount: Number(minOrderAmount),
      expiryDate,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      isActive
    };

    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setCode("");
        setDiscountType("percentage");
        setValue(10);
        setMinOrderAmount(0);
        // Reset 30 days
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setExpiryDate(d.toISOString().slice(0, 10));
        setUsageLimit("");
        setIsActive(true);
        setShowAddForm(false);
        loadCoupons();
        if (triggerRefresh) triggerRefresh();
      } else {
        setFormError(data.error || "Failed to make this discount coupon.");
      }
    } catch (err: any) {
      setFormError("Error contacting network. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCouponActive = async (couponId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/coupons/${couponId}/toggle`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setCoupons(coupons.map(c => c.id === couponId ? { ...c, isActive: !currentStatus } : c));
      }
    } catch (err) {
      console.error("Failed to toggle active state", err);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this discount coupon? (Past orders using it remain fully preserved)")) return;
    try {
      const res = await fetch(`/api/coupons/${couponId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setCoupons(coupons.filter(c => c.id !== couponId));
      }
    } catch (err) {
      console.error("Failed to delete coupon", err);
    }
  };

  const filteredCoupons = coupons.filter(c => {
    return c.code.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div id="admin-coupons-tab" className="space-y-6 animate-in fade-in duration-300">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <Ticket className="h-6 w-6 text-brand-rosegold" />
          <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
            Promo Coupon Codes
          </h2>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-3.5 bg-brand-chocolate text-brand-cream hover:opacity-90 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center space-x-2 transition cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{showAddForm ? "Close Form" : "Create Promo Code"}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateCoupon} className="bg-white border border-brand-pink/25 rounded-3xl p-6 shadow-sm space-y-4 animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-brand-chocolate font-heading italic">Create a New Promotional Discount Code</h3>
          
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1">Promo Code (Forced Uppercase)</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="E.g., CAKE10, REBECCA20"
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2.5 font-bold uppercase mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate placeholder-brand-chocolate/40"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2.5 font-bold mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate"
              >
                <option value="percentage">Percentage Offset (%)</option>
                <option value="fixed">Fixed Dollar Offset ($)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1 animate-pulse">
                Discount Value {discountType === "percentage" ? "(%)" : "($)"}
              </label>
              <input
                type="number"
                required
                min="0.1"
                step="any"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1">Min Subtotal Threshold ($)</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1">Expiry Date limit</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block pl-1">Total Usage Limit (Blank for unlimited)</label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited usage"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-brand-pink/10">
            <label className="flex items-center space-x-2 text-xs font-extrabold uppercase text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-brand-pink/20 accent-brand-rosegold"
              />
              <span>Code is Instantly Active and Usable</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-rosegold hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl transition disabled:opacity-55"
            >
              {submitting ? "Making Coupon..." : "Publish Promo Code Coupon"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search controls */}
      <div className="relative">
        <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter coupon codes by string match..."
          className="w-full text-sm text-brand-chocolate placeholder-brand-chocolate/40 bg-white border border-brand-pink/15 rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-medium"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-sm text-brand-chocolate/85">Syncing bakeshop active coupons database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoupons.length === 0 ? (
            <div className="col-span-full bg-white border border-brand-pink/15 rounded-3xl p-16 text-center text-brand-chocolate/60 font-semibold text-base shadow-sm">
              No promotional coupon codes logged yet. Click "Create Promo Code" to add one!
            </div>
          ) : (
            filteredCoupons.map(c => {
              const isExpired = new Date(c.expiryDate).getTime() < new Date().setHours(0,0,0,0);
              const limitReached = c.usageLimit !== null && c.usageCount >= c.usageLimit;
              const isAvailable = c.isActive && !isExpired && !limitReached;

              return (
                <div
                  key={c.id}
                  className={`bg-white border rounded-[2rem] p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                    isAvailable ? "border-brand-pink/20" : "border-gray-200 opacity-70 bg-gray-50/50"
                  }`}
                >
                  {/* Status Label Overlay */}
                  <div className="absolute top-4 right-4">
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-extrabold uppercase ${
                      isAvailable ? "bg-green-105 text-green-700 border border-green-150" :
                      isExpired ? "bg-red-50 text-red-700 border border-red-150" :
                      limitReached ? "bg-purple-50 text-purple-700 border border-purple-150" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isAvailable ? "Active" : isExpired ? "Expired" : limitReached ? "Limit Reached" : "Inactive"}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] bg-brand-pink/10 text-brand-rosegold tracking-widest font-black uppercase px-2 py-0.5 rounded border border-brand-pink/15">
                        {c.discountType === "percentage" ? "Percent Off" : "Fixed Cash Off"}
                      </span>
                      <h4 className="text-xl font-black text-brand-chocolate font-sans uppercase tracking-tight pt-1">
                        {c.code}
                      </h4>
                    </div>

                    <div className="bg-brand-cream/40 border border-brand-pink/10 rounded-2xl p-4 space-y-2.5 text-xs font-semibold text-brand-chocolate/85">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Discount Value</span>
                        <span className="text-brand-rosegold font-black text-base flex items-center">
                          {c.discountType === "percentage" ? (
                            <>
                              <span>{c.value}%</span>
                              <Percent className="h-4 w-4 ml-0.5 shrink-0 text-brand-rosegold" />
                            </>
                          ) : (
                            <>
                              <span>${c.value.toFixed(2)}</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Min. Subtotal</span>
                        <span>{c.minOrderAmount > 0 ? `$${c.minOrderAmount.toFixed(2)}` : "None"}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Expr. Target</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5 text-brand-chocolate/50 shrink-0" />
                          <span>{c.expiryDate}</span>
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Usages</span>
                        <span>
                          {c.usageCount} / {c.usageLimit !== null ? c.usageLimit : "∞"} limit
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-brand-pink/10 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => handleToggleCouponActive(c.id, c.isActive)}
                      className="text-brand-chocolate hover:text-brand-rosegold transition-colors flex items-center space-x-1.5 cursor-pointer text-xs font-bold"
                    >
                      {c.isActive ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-brand-rosegold" />
                          <span>Active / On</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                          <span>Paused / Off</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id)}
                      className="text-gray-400 hover:text-red-500 hover:scale-105 transition-all cursor-pointer p-1.5"
                      title="Permanently remove promotional coupon code"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
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
