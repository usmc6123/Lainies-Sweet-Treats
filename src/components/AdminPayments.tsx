import React, { useState, useEffect } from "react";
import { 
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, 
  Search, Filter, Receipt, Calendar, Plus, Trash2, 
  CheckCircle2, XCircle, Clock, ShieldAlert, Sparkles,
  FileText, ExternalLink, ChevronDown, Check, RefreshCw
} from "lucide-react";
import { Order, PaymentStatus, Expense } from "../types";

interface AdminPaymentsProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminPayments({ token, triggerRefresh }: AdminPaymentsProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"incoming" | "expenses">("incoming");
  
  // Incoming filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("All");
  const [incomingSearch, setIncomingSearch] = useState("");
  
  // Expense Form State
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseCategory, setExpenseCategory] = useState("Ingredients");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, expensesRes] = await Promise.all([
        fetch("/api/orders", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("/api/expenses", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        // Newest orders first
        oData.sort((a: Order, b: Order) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        setOrders(oData);
      }
      
      if (expensesRes.ok) {
        const eData = await expensesRes.json();
        // Newest expenses first
        eData.sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(eData);
      }
    } catch (err) {
      console.error("Failed to load financial records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle order payment status toggle
  const handleTogglePaymentStatus = async (orderId: string, currentStatus: PaymentStatus) => {
    const nextStatus: PaymentStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentStatus: nextStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(orders.map(o => o.id === orderId ? updated : o));
        triggerRefresh();
      }
    } catch (err) {
      console.error("Error updating payment status", err);
    }
  };

  // Add a new expense record
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDescription || !expenseAmount || isNaN(parseFloat(expenseAmount))) {
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date: expenseDate,
          category: expenseCategory,
          description: expenseDescription,
          amount: parseFloat(parseFloat(expenseAmount).toFixed(2))
        })
      });

      if (res.ok) {
        const newExpense = await res.json();
        setExpenses([newExpense, ...expenses]);
        setExpenseDescription("");
        setExpenseAmount("");
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to post new expense", err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete an expense record
  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm("Are you sure you want to remove this expense record?")) return;
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setExpenses(expenses.filter(exp => exp.id !== expenseId));
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to delete expense record", err);
    }
  };

  // Aggregated Financial Metrics
  const activeOrders = orders.filter(o => o.status !== "Cancelled");
  
  const totalRevenueCollected = activeOrders
    .filter(o => o.paymentStatus === "Paid")
    .reduce((sum, o) => sum + o.total, 0);

  const totalOutstandingPayments = activeOrders
    .filter(o => o.paymentStatus !== "Paid" && o.paymentStatus !== "Refunded")
    .reduce((sum, o) => sum + o.total, 0);

  const stripeRevenue = activeOrders
    .filter(o => o.paymentStatus === "Paid" && o.paymentProvider === "stripe")
    .reduce((sum, o) => sum + o.total, 0);

  const manualRevenue = activeOrders
    .filter(o => o.paymentStatus === "Paid" && o.paymentProvider !== "stripe")
    .reduce((sum, o) => sum + o.total, 0);

  const totalExpensesLogged = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = totalRevenueCollected - totalExpensesLogged;

  // Filter incoming customer payments
  const filteredOrders = activeOrders.filter(o => {
    const matchesSearch = 
      o.customerName.toLowerCase().includes(incomingSearch.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(incomingSearch.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(incomingSearch.toLowerCase());

    const matchesStatus = 
      paymentStatusFilter === "All" || 
      o.paymentStatus === paymentStatusFilter;

    const matchesMethod = 
      paymentMethodFilter === "All" ||
      (paymentMethodFilter === "Stripe" && o.paymentProvider === "stripe") ||
      (paymentMethodFilter === "Manual" && o.paymentProvider !== "stripe");

    return matchesSearch && matchesStatus && matchesMethod;
  });

  // Filter expenses list
  const filteredExpenses = expenses.filter(e => {
    return (
      e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.date.includes(expenseSearch)
    );
  });

  const getPaymentStatusBadgeClass = (status: PaymentStatus) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
      case "Unpaid":
        return "bg-rose-50 text-rose-700 border border-rose-200/60 animate-pulse";
      case "Processing":
      case "Checkout Created":
        return "bg-sky-50 text-sky-700 border border-sky-200/60";
      case "Refunded":
        return "bg-purple-50 text-purple-700 border border-purple-200/60";
      case "Failed":
        return "bg-red-50 text-red-700 border border-red-200/60";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200/60";
    }
  };

  const expenseCategories = [
    "Ingredients",
    "Packaging",
    "Kitchen Supplies",
    "Delivery & Gas",
    "Utilities / Power",
    "Marketing & Ads",
    "Software & Fees",
    "Refunds Issued",
    "Other Services"
  ];

  return (
    <div id="admin-payments-center" className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-brand-pink/20 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-brand-pink/30 rounded-2xl text-brand-rosegold">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading italic">
              Payments & Financial Center
            </h2>
            <p className="text-xs text-brand-chocolate/70 font-semibold uppercase tracking-wider mt-0.5">
              Royse City Bake Shop Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={loadData}
            className="p-3 bg-brand-cream border border-brand-pink/20 text-brand-chocolate hover:bg-brand-pink/10 transition-all rounded-xl shadow-xs cursor-pointer flex items-center justify-center"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <div className="bg-brand-cream border border-brand-pink/20 p-1 rounded-xl flex items-center shrink-0 w-full md:w-auto">
            <button
              onClick={() => setActiveTab("incoming")}
              className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === "incoming" 
                  ? "bg-brand-chocolate text-white shadow-xs" 
                  : "text-brand-chocolate/70 hover:text-brand-chocolate hover:bg-brand-pink/10"
              }`}
            >
              Incoming Inflows
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === "expenses" 
                  ? "bg-brand-chocolate text-white shadow-xs" 
                  : "text-brand-chocolate/70 hover:text-brand-chocolate hover:bg-brand-pink/10"
              }`}
            >
              Outgoing Expenses
            </button>
          </div>
        </div>
      </div>

      {/* FINANCIAL TILES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: Total Revenue Collected */}
        <div className="bg-white border border-brand-pink/15 p-6 rounded-[2.2rem] shadow-sm flex flex-col justify-between relative overflow-hidden transition hover:shadow-md">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#B76E79]">Collected Revenue</span>
              <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl lg:text-4xl font-black font-heading text-brand-chocolate">
              ${totalRevenueCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-4 pt-3 border-t border-brand-pink/10 flex items-center justify-between text-[11px] text-brand-chocolate/60 font-semibold">
            <span>Stripe: ${stripeRevenue.toFixed(0)}</span>
            <span>Manual: ${manualRevenue.toFixed(0)}</span>
          </div>
        </div>

        {/* Metric 2: Outgoing Expenses */}
        <div className="bg-white border border-brand-pink/15 p-6 rounded-[2.2rem] shadow-sm flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase font-extrabold tracking-widest text-rose-500">Total Expenses</span>
              <span className="p-1.5 bg-rose-50 rounded-lg text-rose-500"><TrendingDown className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl lg:text-4xl font-black font-heading text-rose-600">
              ${totalExpensesLogged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-4 pt-3 border-t border-brand-pink/10 text-[11px] text-brand-chocolate/60 font-semibold">
            Logged across {expenses.length} operating records
          </div>
        </div>

        {/* Metric 3: Net Cash Balance */}
        <div className={`p-6 rounded-[2.2rem] border shadow-sm flex flex-col justify-between transition hover:shadow-md ${
          netEarnings >= 0 
            ? "bg-brand-cream/80 border-brand-pink/20" 
            : "bg-red-50/50 border-red-200"
        }`}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#B76E79]">Net Earnings</span>
              <span className={`p-1.5 rounded-lg font-bold text-xs ${netEarnings >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {netEarnings >= 0 ? "SURPLUS" : "DEFICIT"}
              </span>
            </div>
            <h3 className={`text-3xl lg:text-4xl font-black font-heading ${netEarnings >= 0 ? "text-brand-chocolate" : "text-red-700"}`}>
              ${netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-4 pt-3 border-t border-brand-pink/10 text-[11px] text-brand-chocolate/60 font-semibold">
            Bake Shop Net Profit Margin
          </div>
        </div>

        {/* Metric 4: Receivables Outstanding */}
        <div className="bg-white border border-brand-pink/15 p-6 rounded-[2.2rem] shadow-sm flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-500">Outstanding Invoices</span>
              <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Clock className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl lg:text-4xl font-black font-heading text-amber-600 animate-pulse">
              ${totalOutstandingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-4 pt-3 border-t border-brand-pink/10 text-[11px] text-brand-chocolate/60 font-semibold">
            Awaiting Client Settlement
          </div>
        </div>

      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-xs text-brand-chocolate/80 font-bold uppercase tracking-widest">Compiling Cash Ledger...</p>
        </div>
      ) : activeTab === "incoming" ? (
        
        // =========================================================================
        // TAB 1: INFLOWS (INCOMING CUSTOMER PAYMENTS)
        // =========================================================================
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white border border-brand-pink/15 rounded-3xl p-5 shadow-xs">
            <div className="relative w-full lg:w-96">
              <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={incomingSearch}
                onChange={(e) => setIncomingSearch(e.target.value)}
                placeholder="Search payments by name, invoice #, email..."
                className="w-full text-xs bg-brand-cream/30 border border-brand-pink/20 rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Payment Status Dropdown */}
              <div className="flex items-center space-x-2 bg-brand-cream/30 border border-brand-pink/25 rounded-2xl px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-chocolate/55">Status:</span>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-brand-chocolate focus:outline-none cursor-pointer py-1"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">✓ Paid</option>
                  <option value="Unpaid">✖ Unpaid</option>
                  <option value="Processing">Processing</option>
                  <option value="Checkout Created">Checkout Created</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              {/* Payment Method Dropdown */}
              <div className="flex items-center space-x-2 bg-brand-cream/30 border border-brand-pink/25 rounded-2xl px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase text-brand-chocolate/55">Gateway:</span>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-brand-chocolate focus:outline-none cursor-pointer py-1"
                >
                  <option value="All">All Methods</option>
                  <option value="Stripe">Stripe Card Gateway</option>
                  <option value="Manual">Cash / Venmo / Checks</option>
                </select>
              </div>
            </div>
          </div>

          {/* Incoming Payments List */}
          <div className="bg-white border border-brand-pink/15 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/40 border-b border-brand-pink/15">
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Invoice / Order #</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Customer</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Order Date</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-center">Gateway</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-center">Status</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-right">Amount Due</th>
                    <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-pink/10">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-xs text-brand-chocolate/60 font-semibold italic">
                        No customer payments found matching current filtration.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-brand-cream/20 transition-all">
                        <td className="p-4">
                          <span className="font-heading font-black text-brand-chocolate text-xs lg:text-sm">
                            {order.orderNumber}
                          </span>
                          <span className="block text-[9px] text-brand-chocolate/50 font-bold uppercase mt-0.5">
                            {order.type === "delivery" ? "🚗 delivery" : "🎁 pickup"}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-xs lg:text-sm text-brand-chocolate">{order.customerName}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{order.customerEmail}</p>
                        </td>
                        <td className="p-4 text-xs text-gray-500 font-semibold">
                          {new Date(order.orderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-center">
                          {order.paymentProvider === "stripe" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                              STRIPE GATEWAY
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-chocolate/85 bg-brand-cream px-2.5 py-1 rounded-lg border border-brand-pink/20">
                              CASH & MANUAL
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${getPaymentStatusBadgeClass(order.paymentStatus)}`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-xs lg:text-sm text-brand-chocolate">
                          ${order.total.toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle payment status shortcut */}
                            <button
                              onClick={() => handleTogglePaymentStatus(order.id, order.paymentStatus)}
                              className={`p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                                order.paymentStatus === "Paid"
                                  ? "bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100"
                              }`}
                              title={order.paymentStatus === "Paid" ? "Mark as Unpaid" : "Mark as Paid"}
                            >
                              {order.paymentStatus === "Paid" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>

                            {/* PDF Invoice Receipt */}
                            <a
                              href={`/api/orders/${order.id}/receipt?token=${token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-brand-cream border border-brand-pink/20 text-brand-chocolate rounded-lg hover:bg-brand-pink/15 transition-all"
                              title="Download PDF Receipt / Invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </a>

                            {/* Stripe Session link (if exists) */}
                            {order.stripeReceiptUrl && (
                              <a
                                href={order.stripeReceiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-blue-50 border border-blue-200/50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all"
                                title="Open Stripe Official Invoice Receipt"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        
        // =========================================================================
        // TAB 2: OUTFLOWS (BUSINESS EXPENSES)
        // =========================================================================
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Log New Expense Form */}
          <div className="bg-white border border-brand-pink/20 rounded-[2.2rem] p-6 shadow-sm h-fit space-y-6">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-brand-pink/10">
              <Plus className="h-5 w-5 text-brand-rosegold" />
              <h3 className="text-xl font-bold text-brand-chocolate font-heading italic">
                Log Cash Surcharge Expense
              </h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/75">
                  Transaction Date
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full text-xs bg-brand-cream/35 border border-brand-pink/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold"
                />
              </div>

              {/* Category Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/75">
                  Operating Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full text-xs bg-brand-cream/35 border border-brand-pink/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-bold"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/75">
                  Amount Incurred ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-brand-chocolate/55">$</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 124.50"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full text-xs bg-brand-cream/35 border border-brand-pink/20 rounded-xl pl-6 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold"
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/75">
                  Surcharge Notes & Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. 50lbs Butter, Organic flour, and packaging boxes..."
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full text-xs bg-brand-cream/35 border border-brand-pink/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full bg-brand-chocolate hover:opacity-90 text-white text-xs font-extrabold uppercase tracking-widest py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>{formSubmitting ? "Logging Record..." : "Confirm & Save Expense"}</span>
              </button>
            </form>
          </div>

          {/* Right 2 Columns: Expenses List */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search Input */}
            <div className="bg-white border border-brand-pink/15 rounded-2xl p-4 flex items-center gap-3">
              <Search className="h-4 w-4 text-brand-chocolate/40 shrink-0" />
              <input
                type="text"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search expenses by keywords, dates, or categories..."
                className="w-full text-xs bg-transparent focus:outline-none text-brand-chocolate font-semibold"
              />
            </div>

            {/* Expenses Table */}
            <div className="bg-white border border-brand-pink/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-cream/40 border-b border-brand-pink/15">
                      <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Date</th>
                      <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Category</th>
                      <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60">Description</th>
                      <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-right">Cost</th>
                      <th className="p-4 text-[10px] font-extrabold uppercase tracking-wider text-brand-chocolate/60 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-pink/10">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-xs text-brand-chocolate/60 font-semibold italic">
                          No expense records discovered.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-brand-cream/20 transition">
                          <td className="p-4 text-xs text-gray-500 font-bold whitespace-nowrap">
                            {new Date(exp.date + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="p-4">
                            <span className="inline-block px-2.5 py-1 bg-brand-pink/30 text-brand-chocolate text-[10px] font-extrabold rounded-lg uppercase tracking-wider">
                              {exp.category}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-brand-chocolate font-medium leading-relaxed">
                            {exp.description}
                          </td>
                          <td className="p-4 text-right font-extrabold text-xs lg:text-sm text-red-600">
                            -${exp.amount.toFixed(2)}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Delete Expense Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
