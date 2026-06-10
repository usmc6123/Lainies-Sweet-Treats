import React, { useState, useEffect } from "react";
import { Search, Filter, ClipboardList, CheckSquare, Clock, MapPin, Truck, HelpCircle, FileText, Calendar, DollarSign, CheckCircle2 } from "lucide-react";
import { Order, OrderStatus, PaymentStatus } from "../types";

interface AdminOrdersProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminOrders({ token, triggerRefresh }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        data.sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch order history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updated);
        }
        // update main sheet list
        setOrders(orders.map(o => o.id === orderId ? updated : o));
        triggerRefresh();
      }
    } catch (err) {
      alert("Error updating order status.");
    }
  };

  const handlePaymentUpdate = async (orderId: string, paymentStatus: PaymentStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updated);
        }
        setOrders(orders.map(o => o.id === orderId ? updated : o));
        triggerRefresh();
      }
    } catch (err) {
      alert("Error updating payment status.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to permanently delete this order record? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
        setSelectedOrder(null);
        triggerRefresh();
      }
    } catch {
      alert("Error deleting order sheet.");
    }
  };

  // Filter criteria
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);
    
    if (statusFilter === "All") return matchesSearch;
    return matchesSearch && o.status === statusFilter;
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "Pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Confirmed": return "bg-blue-100 text-blue-800 border-blue-200";
      case "In Progress": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Ready": return "bg-green-150 text-green-800 border-green-250";
      case "Delivered/Picked Up": return "bg-emerald-100 text-emerald-800 border-emerald-250";
      case "Cancelled": return "bg-red-100 text-red-800 border-red-200";
    }
  };

  return (
    <div id="admin-orders-tab" className="space-y-6 animate-in fade-in duration-300">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center space-x-2">
          <ClipboardList className="h-5 w-5 text-brand-rosegold" />
          <h2 className="text-xl font-bold text-brand-chocolate font-heading">
            Order Management Console
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, number..."
              className="w-full sm:w-60 text-xs bg-brand-cream/30 border border-brand-pink/15 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
            />
          </div>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Confirmed">Confirmed</option>
            <option value="In Progress">In Progress</option>
            <option value="Ready">Ready</option>
            <option value="Delivered/Picked Up">Delivered/Picked Up</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-xs text-brand-chocolate/85">Loading customer orders...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Orders Sheet list (takes 2/3 space of screen) */}
          <div className="lg:col-span-2 space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-brand-pink/15 rounded-3xl p-16 text-center text-brand-chocolate/50 font-medium">
                No orders discovered that match the filter.
              </div>
            ) : (
              filteredOrders.map(o => (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all ${
                    selectedOrder?.id === o.id 
                      ? "border-brand-rosegold shadow-sm bg-brand-pink/10" 
                      : "border-brand-pink/15 hover:border-brand-pink/40 hover:shadow-xs"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-brand-chocolate">
                          {o.orderNumber}
                        </span>
                        <span className={`text-[10px] px-2.5 py-0.5 border rounded-full font-bold uppercase ${getStatusColor(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-brand-chocolate pt-1">
                        {o.customerName}
                      </h4>
                      <p className="text-xs text-gray-400">
                        Requested Fulfillment: <strong className="text-brand-chocolate">{o.fulfillmentDate}</strong> ({o.type})
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0 space-y-1">
                      <span className="text-sm font-bold text-brand-rosegold block">
                        ${o.total.toFixed(2)}
                      </span>
                      <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold text-white inline-block ${
                        o.paymentStatus === "Paid" ? "bg-green-600" : "bg-red-600"
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detailed side drawer sheet (takes 1/3 space) */}
          <div className="lg:col-span-1">
            {selectedOrder ? (
              <div className="bg-white border border-brand-pink/20 rounded-3xl p-6 shadow-xs space-y-5 animate-in slide-in-from-right duration-250">
                <div className="flex items-center justify-between border-b border-brand-pink/10 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-brand-chocolate/50 bg-gray-100 p-1.5 rounded-sm font-bold">
                      {selectedOrder.orderNumber}
                    </span>
                    <h3 className="text-base font-bold text-brand-chocolate mt-2">
                      Fulfillment Specs
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-brand-chocolate text-xs p-1"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Customer Details */}
                <div className="text-xs space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-[9px] text-brand-chocolate/40">CUSTOMER CONTACT</p>
                  <div>
                    <p className="font-bold text-brand-chocolate">{selectedOrder.customerName}</p>
                    <p className="text-gray-500 mt-0.5">📧 {selectedOrder.customerEmail}</p>
                    <p className="text-gray-500 mt-0.5">📞 {selectedOrder.customerPhone ?? "No Phone"}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="text-xs space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-[9px] text-brand-chocolate/40">ITEMIZED BAKE SPEC</p>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="bg-brand-cream/40 p-2.5 rounded-xl border border-brand-pink/5 space-y-1">
                        <div className="flex justify-between font-semibold text-brand-chocolate">
                          <span>{item.quantity}x {item.name}</span>
                          <span>${item.totalPrice.toFixed(2)}</span>
                        </div>
                        {item.size && <p className="text-[10px] text-gray-500">Scale: {item.size}</p>}
                        {item.flavor && <p className="text-[10px] text-gray-500">Icing/Flavor: {item.flavor}</p>}
                        {item.addOns && item.addOns.length > 0 && (
                          <p className="text-[10px] text-brand-rosegold">Decor: {item.addOns.join(", ")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistics */}
                <div className="text-xs space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-[9px] text-brand-chocolate/40">DELIVERY AND TIMELINES</p>
                  <div className="space-y-1.5 text-xs text-brand-chocolate">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-brand-rosegold" />
                      <span>Due: <strong>{selectedOrder.fulfillmentDate}</strong></span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      {selectedOrder.type === "delivery" ? <Truck className="h-4 w-4 text-brand-rosegold" /> : <MapPin className="h-4 w-4 text-brand-rosegold" />}
                      <span className="capitalize">Type: <strong>{selectedOrder.type}</strong></span>
                    </p>
                    {selectedOrder.type === "delivery" && selectedOrder.deliveryAddress && (
                      <p className="mt-1 bg-brand-cream/30 p-2 border border-brand-pink/10 rounded-lg italic text-[11px]">
                        📍 Address: {selectedOrder.deliveryAddress}
                      </p>
                    )}
                    {selectedOrder.notes && (
                      <div className="mt-2 text-[11px] bg-yellow-50 text-yellow-800 border-2 border-yellow-100 p-2.5 rounded-xl leading-relaxed">
                        <strong>Lainie's Notes:</strong> {selectedOrder.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="text-xs space-y-1.5 pb-4 border-b border-brand-pink/10">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="font-semibold">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sales Tax (TX):</span>
                    <span className="font-semibold">${selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  {selectedOrder.type === "delivery" && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Delivery Charge:</span>
                      <span className="font-semibold">${selectedOrder.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-brand-rosegold pt-2">
                    <span>Final Price:</span>
                    <span>${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Workflow Status Shifter buttons */}
                <div className="space-y-3">
                  <p className="font-bold uppercase tracking-wider text-[9px] text-brand-chocolate/40">MUTATE BAKE WORKFLOW</p>
                  
                  {/* Status selection slider buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Confirmed")}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition ${
                        selectedOrder.status === "Confirmed" 
                          ? "bg-blue-600 text-white border-blue-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Confirm Order
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "In Progress")}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition ${
                        selectedOrder.status === "In Progress" 
                          ? "bg-orange-500 text-white border-orange-500" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Baking / In Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Ready")}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition ${
                        selectedOrder.status === "Ready" 
                          ? "bg-green-600 text-white border-green-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Ready for Pickup!
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Delivered/Picked Up")}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition ${
                        selectedOrder.status === "Delivered/Picked Up" 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Completed
                    </button>
                  </div>

                  {/* Payment toggle */}
                  <div className="pt-2 flex justify-between items-center bg-brand-cream/30 p-2.5 rounded-xl border border-brand-pink/10">
                    <span className="text-[11px] font-bold text-brand-chocolate">Payment Balance:</span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handlePaymentUpdate(selectedOrder.id, "Unpaid")}
                        className={`px-3 py-1 text-[10px] rounded-lg font-bold ${
                          selectedOrder.paymentStatus === "Unpaid" ? "bg-red-600 text-white" : "bg-white border border-gray-100 text-gray-500"
                        }`}
                      >
                        Unpaid
                      </button>
                      <button
                        onClick={() => handlePaymentUpdate(selectedOrder.id, "Paid")}
                        className={`px-3 py-1 text-[10px] rounded-lg font-bold ${
                          selectedOrder.paymentStatus === "Paid" ? "bg-green-600 text-white" : "bg-white border border-gray-100 text-gray-500"
                        }`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    className="w-full text-center py-2 border border-red-200 hover:bg-red-50 text-red-700 text-[10px] font-bold rounded-xl transition"
                  >
                    Delete Custody Sheet
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-brand-pink/30 rounded-3xl p-16 text-center text-brand-chocolate/50 flex flex-col items-center justify-center">
                <FileText className="h-10 w-10 text-brand-pink mb-3" />
                <p className="text-sm font-semibold">Select an order sheet</p>
                <p className="text-xs text-gray-400 mt-1">Review active items, special ingredient annotations, mutate order status workflow, and toggles.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
