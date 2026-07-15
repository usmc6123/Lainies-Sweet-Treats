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
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem("admin_order_search") || "";
  });
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [batchLabelDate, setBatchLabelDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

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

  useEffect(() => {
    const savedSearch = localStorage.getItem("admin_order_search");
    if (savedSearch && orders.length > 0) {
      const matched = orders.find(o => 
        o.orderNumber === savedSearch || 
        o.orderNumber.toLowerCase() === savedSearch.toLowerCase()
      );
      if (matched) {
        setSelectedOrder(matched);
      }
      localStorage.removeItem("admin_order_search");
    }
  }, [orders]);

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

  const handleDownloadReceipt = (orderId: string) => {
    const downloadUrl = `/api/orders/receipt?orderId=${orderId}&token=${token}`;
    window.location.href = downloadUrl;
  };

  const handlePrintSingleLabel = (orderId: string) => {
    const downloadUrl = `/api/orders/labels?orderId=${orderId}&token=${token}`;
    window.open(downloadUrl, '_blank');
  };

  const handlePrintBatchLabels = () => {
    if (!batchLabelDate) {
      alert("Please select a date first.");
      return;
    }
    const downloadUrl = `/api/orders/labels/date?date=${batchLabelDate}&token=${token}`;
    window.open(downloadUrl, '_blank');
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
      <div className="flex flex-col gap-4 bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center space-x-2">
            <ClipboardList className="h-6 w-6 text-brand-rosegold" />
            <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
              Order Management Console
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search bar */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, number..."
                className="w-full sm:w-64 text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
              />
            </div>

            {/* Status selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-medium text-brand-chocolate"
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

        {/* Bulk Labels Generator section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-brand-pink/10 pt-4 gap-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-brand-chocolate/75">
            <Calendar className="h-4 w-4 text-brand-rosegold" />
            <span>Fulfillment Date for Batch Labels:</span>
            <input
              type="date"
              value={batchLabelDate}
              onChange={(e) => setBatchLabelDate(e.target.value)}
              className="ml-2 text-xs bg-brand-cream/30 border border-brand-pink/15 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-bold text-brand-chocolate"
            />
          </div>
          <button
            onClick={handlePrintBatchLabels}
            className="w-full sm:w-auto bg-brand-pink text-white hover:bg-brand-rosegold hover:text-brand-chocolate font-bold text-xs uppercase px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <CheckSquare className="h-4 w-4" />
            Print Daily Label Sheets ({orders.filter(o => o.fulfillmentDate === batchLabelDate && o.status !== 'Cancelled').length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-sm text-brand-chocolate/85">Loading customer orders...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Orders Sheet list (takes 2/3 space of screen) */}
          <div className="lg:col-span-2 space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-brand-pink/15 rounded-3xl p-16 text-center text-brand-chocolate/60 text-base font-semibold">
                No orders discovered that match the filter.
              </div>
            ) : (
              filteredOrders.map(o => (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all ${
                    selectedOrder?.id === o.id 
                       ? "border-brand-rosegold shadow-md bg-brand-pink/10" 
                       : "border-brand-pink/15 hover:border-brand-pink/40 hover:shadow-xs"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-brand-chocolate bg-brand-pink/20 px-2 py-0.5 rounded">
                          {o.orderNumber}
                        </span>
                        <span className={`text-xs px-3 py-1 border rounded-full font-bold uppercase ${getStatusColor(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-brand-chocolate pt-1">
                        {o.customerName}
                      </h4>
                      <p className="text-sm text-gray-500 font-medium">
                        Requested Fulfillment: <strong className="text-brand-chocolate">{o.fulfillmentDate}</strong> ({o.type})
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0 space-y-1">
                      <span className="text-base lg:text-lg font-extrabold text-brand-rosegold block">
                        ${o.total.toFixed(2)}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold text-white inline-block ${
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
              <div className="bg-white border border-brand-pink/20 rounded-3xl p-6 shadow-sm space-y-6 animate-in slide-in-from-right duration-250">
                <div className="flex items-center justify-between border-b border-brand-pink/10 pb-4">
                   <div>
                    <span className="text-xs font-mono text-brand-chocolate/60 bg-brand-pink/30 px-2.5 py-1 rounded-full font-bold">
                       {selectedOrder.orderNumber}
                     </span>
                    <h3 className="text-lg font-bold text-brand-chocolate mt-3 font-heading">
                       Fulfillment Specs
                     </h3>
                   </div>
                   <button
                     onClick={() => setSelectedOrder(null)}
                     className="text-gray-400 hover:text-brand-chocolate text-xs lg:text-sm font-bold bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full transition"
                   >
                     ✕ Close
                   </button>
                </div>

                {/* Customer Details */}
                <div className="text-sm space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-xs text-brand-chocolate/40">CUSTOMER CONTACT</p>
                  <div className="space-y-1">
                    <p className="font-bold text-brand-chocolate text-base">{selectedOrder.customerName}</p>
                    <p className="text-gray-600 mt-1">📧 {selectedOrder.customerEmail}</p>
                    <p className="text-gray-600">📞 {selectedOrder.customerPhone ?? "No Phone"}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="text-sm space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-xs text-brand-chocolate/40">ITEMIZED BAKE SPEC</p>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="bg-brand-cream/40 p-3.5 rounded-xl border border-brand-pink/5 space-y-1.5">
                        <div className="flex justify-between font-bold text-brand-chocolate text-sm">
                           <span>{item.quantity}x {item.name}</span>
                           <span>${item.totalPrice.toFixed(2)}</span>
                        </div>
                        {item.size && <p className="text-xs text-gray-500 font-medium">Scale: {item.size}</p>}
                        {item.flavor && <p className="text-xs text-gray-500 font-medium">Icing/Flavor: {item.flavor}</p>}
                        {item.addOns && item.addOns.length > 0 && (
                          <p className="text-xs text-brand-rosegold font-bold">Toppings: {item.addOns.join(", ")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistics */}
                <div className="text-sm space-y-2 pb-4 border-b border-brand-pink/10">
                  <p className="font-bold uppercase tracking-wider text-xs text-brand-chocolate/40">DELIVERY AND TIMELINES</p>
                  <div className="space-y-2 text-sm text-brand-chocolate">
                    <p className="flex items-center gap-2">
                       <Calendar className="h-4 w-4 text-brand-rosegold" />
                       <span>Due: <strong>{selectedOrder.fulfillmentDate}</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                       {selectedOrder.type === "delivery" ? <Truck className="h-4 w-4 text-brand-rosegold" /> : <MapPin className="h-4 w-4 text-brand-rosegold" />}
                       <span className="capitalize">Type: <strong>{selectedOrder.type}</strong></span>
                    </p>
                    {selectedOrder.type === "delivery" && selectedOrder.deliveryAddress && (
                      <p className="mt-1 bg-brand-cream/30 p-2.5 border border-brand-pink/10 rounded-lg italic text-xs leading-relaxed">
                        📍 Address: {selectedOrder.deliveryAddress}
                      </p>
                    )}
                    {selectedOrder.notes && (
                      <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 border border-yellow-250 p-3 rounded-xl leading-relaxed font-medium">
                        <strong>Lainie's Notes:</strong> {selectedOrder.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="text-sm space-y-2 pb-4 border-b border-brand-pink/10">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Sales Tax (TX):</span>
                    <span className="font-semibold">${selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  {selectedOrder.type === "delivery" && (
                    <div className="flex justify-between text-gray-500">
                      <span>Delivery Charge:</span>
                      <span className="font-semibold">${selectedOrder.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-brand-chocolate pt-2">
                    <span>Final Price:</span>
                    <span className="text-lg text-brand-rosegold">${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Workflow Status Shifter buttons */}
                <div className="space-y-4">
                  <p className="font-bold uppercase tracking-wider text-xs text-brand-chocolate/40">MUTATE BAKE WORKFLOW</p>
                  
                  {/* Status selection slider buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Confirmed")}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                        selectedOrder.status === "Confirmed" 
                          ? "bg-blue-600 text-white border-blue-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Confirm Order
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "In Progress")}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                        selectedOrder.status === "In Progress" 
                          ? "bg-orange-500 text-white border-orange-500" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Baking / In Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Ready")}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                        selectedOrder.status === "Ready" 
                          ? "bg-green-600 text-white border-green-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Ready for Pickup!
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedOrder.id, "Delivered/Picked Up")}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition ${
                        selectedOrder.status === "Delivered/Picked Up" 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : "border-gray-100 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Completed
                    </button>
                  </div>

                  {/* Payment toggle */}
                  <div className="pt-2 flex justify-between items-center bg-brand-cream/30 p-3 rounded-xl border border-brand-pink/10">
                    <span className="text-xs font-bold text-brand-chocolate">Payment Balance:</span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePaymentUpdate(selectedOrder.id, "Unpaid")}
                        className={`px-3.5 py-1.5 text-xs rounded-lg font-bold ${
                          selectedOrder.paymentStatus === "Unpaid" ? "bg-red-600 text-white" : "bg-white border border-gray-100 text-gray-500"
                        }`}
                      >
                        Unpaid
                      </button>
                      <button
                        onClick={() => handlePaymentUpdate(selectedOrder.id, "Paid")}
                        className={`px-3.5 py-1.5 text-xs rounded-lg font-bold ${
                          selectedOrder.paymentStatus === "Paid" ? "bg-green-600 text-white" : "bg-white border border-gray-100 text-gray-500"
                        }`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* PDF & Printing tools */}
                  <div className="space-y-2 pt-2 border-t border-brand-pink/10">
                    <p className="font-bold uppercase tracking-wider text-[10px] text-brand-chocolate/50 mb-1 block">PRINTING & ARCHIVES</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleDownloadReceipt(selectedOrder.id)}
                        className="py-2 px-3 border border-brand-pink hover:bg-brand-pink/5 text-[11px] font-bold rounded-xl text-brand-pink flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice PDF
                      </button>
                      <button
                        onClick={() => handlePrintSingleLabel(selectedOrder.id)}
                        className="py-2 px-3 border border-brand-pink hover:bg-brand-pink/5 text-[11px] font-bold rounded-xl text-brand-pink flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Print Label
                      </button>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    className="w-full text-center py-2.5 border border-red-200 hover:bg-red-50 text-red-750 text-xs font-bold rounded-xl transition mt-2"
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
