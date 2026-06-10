import React, { useState, useEffect } from "react";
import { Sparkles, Clipboard, CheckCircle, Search, HelpCircle, FilePlus, DollarSign, Clock, Trash, FolderHeart } from "lucide-react";
import { Quote, Product, OrderItem } from "../types";

interface AdminQuotesProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminQuotes({ token, triggerRefresh }: AdminQuotesProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // Proposal form fields
  const [priceProposal, setPriceProposal] = useState<number>(0);
  const [proposalNotes, setProposalNotes] = useState<string>("");
  const [proposedItems, setProposedItems] = useState<OrderItem[]>([]);
  
  // Helpers for adding individual items to the draft proposal
  const [selectedProdId, setSelectedProdId] = useState("");
  const [selectedProdQty, setSelectedProdQty] = useState(1);

  const fetchQuotesAndProducts = async () => {
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        fetch("/api/quotes", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("/api/products")
      ]);
      if (qRes.ok) setQuotes(await qRes.json());
      if (pRes.ok) setProducts(await pRes.json());
    } catch (err) {
      console.error("Failed to load quotes or catalog items", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotesAndProducts();
  }, [token]);

  // When a quote is selected, initialize the proposal editors
  const handleSelectQuote = (q: Quote) => {
    setSelectedQuote(q);
    setPriceProposal(q.priceProposal || 0);
    setProposalNotes(q.notes || "");
    setProposedItems(q.proposedItems || []);
  };

  const handleAddProposedItem = () => {
    if (!selectedProdId) return;
    const prod = products.find(p => p.id === selectedProdId);
    if (!prod) return;

    const existsIndex = proposedItems.findIndex(x => x.productId === selectedProdId);
    if (existsIndex !== -1) {
      const updated = [...proposedItems];
      updated[existsIndex].quantity += selectedProdQty;
      updated[existsIndex].totalPrice = updated[existsIndex].quantity * updated[existsIndex].unitPrice;
      setProposedItems(updated);
    } else {
      const newItem: OrderItem = {
        productId: prod.id,
        name: prod.name,
        quantity: selectedProdQty,
        unitPrice: prod.basePrice,
        totalPrice: prod.basePrice * selectedProdQty
      };
      setProposedItems([...proposedItems, newItem]);
    }

    // Recalculate proposal total based on item totals!
    const itemsTotal = [...proposedItems].reduce((sum, x) => sum + x.totalPrice, 0) + (prod.basePrice * selectedProdQty);
    setPriceProposal(parseFloat(itemsTotal.toFixed(2)));

    // Reset controls
    setSelectedProdId("");
    setSelectedProdQty(1);
  };

  const handleRemoveProposedItem = (index: number) => {
    const updated = [...proposedItems];
    updated.splice(index, 1);
    setProposedItems(updated);

    const itemsTotal = updated.reduce((sum, x) => sum + x.totalPrice, 0);
    setPriceProposal(parseFloat(itemsTotal.toFixed(2)));
  };

  const handlePublishProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    if (priceProposal <= 0) {
      alert("Please enter a proposed total greater than zero.");
      return;
    }

    try {
      const payload = {
        priceProposal: Number(priceProposal),
        notes: proposalNotes,
        proposedItems,
        status: "Sent" as const
      };

      const res = await fetch(`/api/quotes/${selectedQuote.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setQuotes(quotes.map(q => q.id === selectedQuote.id ? updated : q));
        setSelectedQuote(updated);
        triggerRefresh();
        alert(`Bespoke Proposal successfully sent for Quote ${updated.quoteNumber}!`);
      }
    } catch {
      alert("Error writing quote proposal info.");
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm("Are you sure you want to delete this custom quote request?")) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setQuotes(quotes.filter(q => q.id !== quoteId));
        setSelectedQuote(null);
        triggerRefresh();
      }
    } catch {
      alert("Error deleting quote sheet.");
    }
  };

  // Filter criteria
  const filteredQuotes = quotes.filter(q => {
    const matchesEmail = q.contactEmail.toLowerCase().includes(searchEmail.toLowerCase()) || q.contactName.toLowerCase().includes(searchEmail.toLowerCase());
    if (statusFilter === "All") return matchesEmail;
    return matchesEmail && q.status === statusFilter;
  });

  return (
    <div id="admin-quotes-tab" className="space-y-6 animate-in fade-in duration-300">
      {/* Tab Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-6 w-6 text-brand-rosegold" />
          <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
            Custom Event Quote Sheets
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Email/Client search */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Search by client or email..."
              className="w-full sm:w-64 text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
            />
          </div>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-brand-cream/30 border border-brand-pink/15 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold"
          >
            <option value="All">All Estimates</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Sent">Proposal Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-sm text-brand-chocolate/85">Loading event sheets...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Custom Quote requests list (takes 1/3 layout space) */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-[#B76E79] px-1">
              Active Estimates ({filteredQuotes.length})
            </h3>
            {filteredQuotes.length === 0 ? (
              <div className="bg-white border border-brand-pink/10 rounded-2xl p-10 text-center text-brand-chocolate/60 font-semibold text-sm">
                No active quote sheets matching filter found.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredQuotes.map(q => (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuote(q)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      selectedQuote?.id === q.id 
                        ? "bg-brand-pink/15 border-brand-rosegold shadow-sm" 
                        : "bg-white border-brand-pink/15 hover:border-brand-pink/30 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-gray-500">{q.quoteNumber}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-extrabold uppercase block leading-none ${
                        q.status === "Pending Review" ? "bg-yellow-100 text-yellow-800" :
                        q.status === "Sent" ? "bg-blue-100 text-blue-700 font-bold border border-blue-200" :
                        q.status === "Accepted" ? "bg-green-150 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {q.status}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-brand-chocolate mt-3 leading-tight font-heading">
                      {q.eventType} ({q.servings} Servings)
                    </h4>
                    <p className="text-sm text-gray-500 font-medium mt-1.5">
                      Client: <span className="font-bold text-brand-chocolate">{q.contactName}</span> • Due {q.eventDate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed sheet reviewer & compiler workspace (takes 2/3 layout space) */}
          <div className="lg:col-span-2">
            {selectedQuote ? (
              <div className="bg-white border border-brand-pink/20 rounded-3xl p-7 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-pink/10 pb-4">
                  <div>
                    <span className="text-xs font-mono tracking-wider bg-brand-pink/30 px-2.5 py-1 rounded-md text-brand-chocolate font-bold">
                      {selectedQuote.quoteNumber}
                    </span>
                    <h3 className="text-2xl font-bold font-heading text-brand-chocolate mt-3">
                      Review Custom Request Specs
                    </h3>
                  </div>

                  <button
                    onClick={() => handleDeleteQuote(selectedQuote.id)}
                    className="flex items-center space-x-1.5 text-red-600 hover:text-red-700 text-sm font-bold bg-ref-50 hover:bg-red-50 px-3.5 py-1.5 rounded-xl border border-red-100 transition"
                  >
                    <Trash className="h-4 w-4" />
                    <span>Delete Quote</span>
                  </button>
                </div>

                {/* Details split panels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm bg-brand-cream/30 p-5 border border-brand-pink/10 rounded-2xl">
                  <div>
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Main Event</span>
                    <p className="font-bold text-brand-chocolate mt-1 text-base">{selectedQuote.eventType}</p>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Due Event Date</span>
                    <p className="font-bold text-brand-chocolate mt-1 text-base">{selectedQuote.eventDate}</p>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Total Servings</span>
                    <p className="font-bold text-brand-chocolate mt-1 text-base">{selectedQuote.servings} Servings</p>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Client Budget Filter</span>
                    <p className="font-bold text-brand-chocolate mt-1 text-base">{selectedQuote.budgetRange}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Contact details</span>
                    <p className="text-brand-chocolate font-semibold mt-1 text-sm lg:text-base">
                      {selectedQuote.contactName} • 📧 {selectedQuote.contactEmail} • 📞 {selectedQuote.contactPhone}
                    </p>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Flavor Preferences</span>
                    <p className="text-gray-700 italic mt-1 font-medium text-sm lg:text-base">"{selectedQuote.flavorPreferences}"</p>
                  </div>
                  <div className="col-span-2 pt-1 font-sans">
                    <span className="block text-xs uppercase tracking-widest font-bold text-brand-rosegold">Bespoke Design Outline</span>
                    <p className="text-brand-chocolate mt-1.5 bg-white p-4 rounded-xl border border-brand-pink/10 leading-relaxed font-semibold">
                      "{selectedQuote.designIdeas}"
                    </p>
                  </div>
                </div>

                {/* Proposal Designer Form Workspace */}
                {selectedQuote.status === "Pending Review" || selectedQuote.status === "Sent" ? (
                  <form onSubmit={handlePublishProposal} className="space-y-5 pt-4 border-t border-brand-pink/10">
                    <h4 className="text-base font-bold text-brand-chocolate flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-brand-rosegold" />
                      <span>Configure Lainie's Bespoke Proposal Pricing</span>
                    </h4>

                    {/* Step A: Add pre-configured products from catalog to proposal */}
                    <div className="bg-brand-pink/10 p-5 border border-brand-pink/30 rounded-2xl space-y-4">
                      <span className="block text-xs uppercase font-bold text-brand-chocolate/70 tracking-widest text-[#B76E79]">
                        Step 1: Itemize proposed catalog sweets (optional)
                      </span>
                      
                      <div className="flex flex-wrap gap-2.5">
                        <select
                          value={selectedProdId}
                          onChange={(e) => setSelectedProdId(e.target.value)}
                          className="flex-1 text-sm bg-white border border-brand-pink/15 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-medium"
                        >
                          <option value="">-- Choose Menu Product --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - ${p.basePrice.toFixed(2)}</option>
                          ))}
                        </select>
                        
                        <input
                          type="number"
                          min="1"
                          value={selectedProdQty}
                          onChange={(e) => setSelectedProdQty(Number(e.target.value))}
                          className="w-20 text-sm bg-white border border-brand-pink/15 rounded-xl text-center focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-bold"
                          placeholder="Qty"
                        />

                        <button
                          type="button"
                          onClick={handleAddProposedItem}
                          className="bg-brand-chocolate text-white text-sm px-5 py-2.5 rounded-xl font-bold transition hover:opacity-95"
                        >
                          Add Row
                        </button>
                      </div>

                      {/* Display proposed item list */}
                      {proposedItems.length > 0 && (
                        <div className="space-y-2 pt-3 border-t border-brand-pink/20 max-h-36 overflow-y-auto pr-1">
                          {proposedItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm text-brand-chocolate bg-white px-4 py-2.5 border border-brand-pink/10 rounded-lg">
                              <span><strong>{item.quantity}x</strong> {item.name}</span>
                              <div className="flex items-center space-x-3">
                                <span className="font-extrabold text-brand-rosegold">${item.totalPrice.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProposedItem(idx)}
                                  className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 hover:bg-red-100 p-1 rounded-md"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      {/* Price Proposal */}
                      <div className="sm:col-span-1">
                        <label className="text-xs uppercase font-bold text-brand-chocolate/70 block">
                          Step 2: Total Price Proposal ($)
                        </label>
                        <div className="relative mt-1.5">
                          <DollarSign className="h-4.5 w-4.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                          <input
                            type="number"
                            required
                            min="1.0"
                            step="0.01"
                            value={priceProposal}
                            onChange={(e) => setPriceProposal(Number(e.target.value))}
                            className="w-full text-sm font-extrabold text-brand-rosegold bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-9 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs uppercase font-bold text-brand-chocolate/70 block">
                          Step 3: Design, Setup & Icing Notes to Client
                        </label>
                        <input
                          type="text"
                          value={proposalNotes}
                          onChange={(e) => setProposalNotes(e.target.value)}
                          placeholder="We can prepare vanilla/strawberry layers. Price includes full delivery & floral set."
                          className="w-full text-sm bg-brand-cream/20 border border-brand-pink/15 rounded-xl p-3 mt-1.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-brand-rosegold text-white text-sm font-bold py-3.5 rounded-xl hover:opacity-90 transition shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Sparkles className="h-5 w-5 text-yellow-300" />
                      <span>Publish & Send Quote Proposal to Client Portal</span>
                    </button>
                  </form>
                ) : selectedQuote.status === "Accepted" ? (
                  <div className="mt-4 p-5 bg-green-50 text-green-905 border border-green-250 rounded-2xl text-sm space-y-2 font-medium">
                    <p className="font-bold flex items-center gap-1.5 text-base text-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600 animate-bounce" />
                      Celebration Estimate Accepted by Customer!
                    </p>
                    <p>
                      Agreed pricing proposal total: <strong className="text-base text-brand-chocolate font-bold">${selectedQuote.priceProposal?.toFixed(2)}</strong>.
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                      This has been converted automatically to a Confirmed Order in your calendar scheduler. Check your master order sheets!
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-5 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-sm leading-relaxed font-medium">
                    <span className="font-bold text-base flex items-center gap-1.5"><Clipboard className="h-5 w-5" />Customer Declined Proposal Pricing</span>
                    <p className="mt-2 text-gray-700">
                      The client declined this budget structure. Feel free to contact Rebeca or Michael to negotiate alternative designs or servings count!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-brand-pink/30 rounded-3xl p-20 text-center text-brand-chocolate/50 flex flex-col items-center justify-center">
                <FolderHeart className="h-12 w-12 text-brand-pink mb-4" />
                <p className="text-base font-bold text-brand-chocolate">Select an event request quote card</p>
                <p className="text-sm text-gray-500 mt-2 max-w-lg leading-relaxed">Analyze requested servings metrics, build custom line item proposals, draft designs and broadcast estimates directly to client portals.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
