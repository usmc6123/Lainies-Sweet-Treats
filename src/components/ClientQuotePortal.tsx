import React, { useState } from "react";
import { Mail, Search, CheckCircle, XCircle, Clock, Sparkles, FileText, ChevronRight, CornerDownRight } from "lucide-react";
import { Quote } from "../types";

export default function ClientQuotePortal() {
  const [emailQuery, setEmailQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchedQuotes, setFetchedQuotes] = useState<Quote[] | null>(null);
  const [searchedEmail, setSearchedEmail] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchClientQuotes = async (email: string) => {
    if (!email) return;
    setLoading(true);
    setNoticeMessage("");
    setFetchedQuotes(null);
    setSelectedQuote(null);
    
    try {
      // Fetch all quotes from backend (we filter by email inside server or cleanly here)
      // Since it is public, we can fetch all and filter or send a clean query
      const res = await fetch("/api/quotes");
      if (res.ok) {
        const data: Quote[] = await res.json();
        const filtered = data.filter(q => q.contactEmail.toLowerCase().trim() === email.toLowerCase().trim());
        setFetchedQuotes(filtered);
        setSearchedEmail(email);
        if (filtered.length === 0) {
          setNoticeMessage("No custom quotes or event estimations found for this email address. Try requesting a new quote!");
        }
      } else {
        setNoticeMessage("Could not authenticate portal access. Please try again.");
      }
    } catch {
      setNoticeMessage("Workspace connection failed. Please consult Lainie directly!");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClientQuotes(emailQuery.trim());
  };

  const handleRespond = async (quoteId: string, action: "accept" | "decline") => {
    setProcessingId(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();

      if (res.ok) {
        // Refresh quotes
        await fetchClientQuotes(searchedEmail);
        // Show updated active selection
        if (selectedQuote && selectedQuote.id === quoteId) {
          setSelectedQuote({
            ...selectedQuote,
            status: action === "accept" ? "Accepted" : "Declined"
          });
        }
      } else {
        alert(data.error || "Failed to update quote contract status.");
      }
    } catch (err) {
      alert("Error sending response to Lainie's shop.");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: Quote["status"]) => {
    switch (status) {
      case "Pending Review":
        return (
          <span className="inline-flex items-center space-x-1 bg-yellow-50 text-yellow-800 border border-yellow-250 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase">
            <Clock className="h-3 w-3" />
            <span>Under Review</span>
          </span>
        );
      case "Sent":
        return (
          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-800 border border-blue-250 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase animate-pulse">
            <Sparkles className="h-3 w-3" />
            <span>Proposal Ready</span>
          </span>
        );
      case "Accepted":
        return (
          <span className="inline-flex items-center space-x-1 bg-green-50 text-green-800 border border-green-250 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase">
            <CheckCircle className="h-3 w-3" />
            <span>Contract Accepted</span>
          </span>
        );
      case "Declined":
        return (
          <span className="inline-flex items-center space-x-1 bg-red-50 text-red-800 border border-red-250 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase">
            <XCircle className="h-3 w-3" />
            <span>Declined</span>
          </span>
        );
    }
  };

  return (
    <div id="interactive-portal" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="mx-auto h-16 w-16 rounded-xl overflow-hidden border border-brand-pink/30 bg-black shadow-md p-1 hover:scale-105 transition-transform duration-300 shrink-0 mb-4">
          <img 
            src="https://github.com/usmc6123/images/blob/main/SweetTreatLogo.webp?raw=true" 
            alt="Lainie's Sweet Treats Logo" 
            className="h-full w-full object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="bg-brand-pink/60 text-brand-chocolate px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Client Contract Dashboard
        </span>
        <h2 className="text-4xl mt-3 text-brand-chocolate font-bold tracking-tight font-heading">
          Interactive <span className="italic font-normal text-brand-rosegold">Client Portal</span>
        </h2>
        <p className="mt-2.5 text-xs text-brand-chocolate/75 leading-relaxed font-semibold">
          Enter the email address you used to request your custom wedding or party treats to view pending estimates, respond to proposals, or review historic orders instantly.
        </p>

        {/* Query Input bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-2 max-w-sm mx-auto">
          <div className="relative flex-1">
            <Mail className="h-4 w-4 text-brand-chocolate/40 absolute left-4 top-3.5" />
            <input
              type="email"
              required
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Enter your contact email..."
              className="w-full text-xs bg-white border border-brand-pink/20 rounded-full pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-chocolate text-brand-cream hover:opacity-90 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition flex items-center justify-center shadow-xs"
          >
            {loading ? "..." : <Search className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {noticeMessage && (
        <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-250 rounded-2xl text-xs text-center max-w-md mx-auto mb-8 font-medium">
          {noticeMessage}
        </div>
      )}

      {/* Main portal grid display */}
      {fetchedQuotes !== null && fetchedQuotes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Quotes list */}
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-rosegold mb-3">
              Your Custom Quotes ({fetchedQuotes.length})
            </h3>
            <div className="space-y-4">
              {fetchedQuotes.map(q => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuote(q)}
                  className={`p-5 rounded-[1.8rem] border cursor-pointer transition-all ${
                    selectedQuote?.id === q.id 
                      ? "bg-brand-pink/30 border-brand-rosegold shadow-xs" 
                      : "bg-white border-brand-pink/15 hover:border-brand-pink/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-chocolate">
                      {q.quoteNumber}
                    </span>
                    {getStatusBadge(q.status)}
                  </div>
                  <h4 className="text-xs font-bold text-brand-chocolate mt-2.5 leading-tight">
                    {q.eventType}
                  </h4>
                  <div className="flex justify-between items-center text-[10px] mt-3 pt-3 border-t border-brand-pink/10 text-brand-chocolate/60">
                    <span>Due: {q.eventDate}</span>
                    <span className="font-bold text-brand-rosegold">
                      {q.priceProposal ? `$${q.priceProposal.toFixed(2)}` : q.budgetRange}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quote inspector detail column */}
          <div className="md:col-span-2">
            {selectedQuote ? (
              <div className="bg-white border border-brand-rosegold/10 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-pink/20 pb-5">
                  <div>
                    <span className="text-[9px] font-mono tracking-widest text-brand-chocolate/50 bg-brand-pink/30 px-2.5 py-1 rounded-full font-bold">
                      REFERENCE #{selectedQuote.quoteNumber}
                    </span>
                    <h3 className="text-xl font-bold text-brand-chocolate mt-2 font-heading italic">
                      {selectedQuote.eventType} Celebration Setup
                    </h3>
                    <p className="text-xs text-brand-chocolate/65 mt-0.5">
                      Fulfillment Goal: <strong className="text-brand-chocolate">{selectedQuote.eventDate}</strong>
                    </p>
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(selectedQuote.status)}
                  </div>
                </div>

                {/* Details grid split */}
                <div className="grid grid-cols-2 gap-4 py-5 text-xs">
                  <div>
                    <p className="text-brand-chocolate/55 uppercase tracking-[0.15em] font-semibold text-[9px]">Servings Range</p>
                    <p className="font-bold text-brand-chocolate text-[13px] mt-0.5">{selectedQuote.servings} guests</p>
                  </div>
                  <div>
                    <p className="text-brand-chocolate/55 uppercase tracking-[0.15em] font-semibold text-[9px]">Requested Budget Filter</p>
                    <p className="text-brand-chocolate/85 font-medium mt-0.5">{selectedQuote.budgetRange}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-brand-chocolate/55 uppercase tracking-[0.15em] font-semibold text-[9px]">Flavors Selected</p>
                    <p className="text-brand-chocolate/85 mt-0.5 italic">"{selectedQuote.flavorPreferences}"</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-brand-chocolate/55 uppercase tracking-[0.15em] font-semibold text-[9px]">Custom Design Outline & Ideas</p>
                    <p className="text-brand-chocolate/85 mt-0.5 leading-relaxed bg-brand-cream/50 p-4 rounded-xl border border-brand-pink/10">"{selectedQuote.designIdeas}"</p>
                  </div>
                </div>

                {/* Lainie's Proposal section */}
                {selectedQuote.status === "Sent" ? (
                  <div className="mt-4 p-6 bg-brand-pink/20 border border-brand-pink/40 rounded-[2rem]">
                    <h4 className="text-xs font-bold text-brand-chocolate uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-brand-rosegold" />
                      Lainie's Sweet Proposal & Cost Details
                    </h4>
                    
                    {selectedQuote.notes && (
                      <p className="text-xs text-gray-700 mt-2 bg-white/70 p-4 rounded-xl border border-brand-pink/5 leading-relaxed">
                        <strong>Lainie's Design Notes:</strong> {selectedQuote.notes}
                      </p>
                    )}

                    {/* Proposed items */}
                    {selectedQuote.proposedItems && selectedQuote.proposedItems.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-chocolate/60">
                          Proposed Treats Configuration:
                        </p>
                        {selectedQuote.proposedItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-start text-xs text-brand-chocolate pl-2">
                            <CornerDownRight className="h-3.5 w-3.5 text-brand-rosegold mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="font-semibold">{item.quantity}x {item.name}{item.variationName ? ` (${item.variationName})` : ""}</p>
                              {(item.size || item.flavor) && (
                                <p className="text-[10px] text-gray-500">
                                  {item.size ? `Size: ${item.size}` : ""} {item.flavor ? `• Flavor: ${item.flavor}` : ""}
                                </p>
                              )}
                            </div>
                            <span className="font-mono font-bold">${item.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-brand-pink/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] tracking-wider text-brand-chocolate/60 block uppercase font-medium">Bespoke Proposal Total</span>
                        <span className="text-3.5xl font-bold font-heading text-brand-chocolate">${selectedQuote.priceProposal?.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">*Plus state sales tax at confirmation</span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleRespond(selectedQuote.id, "decline")}
                          disabled={processingId !== null}
                          className="px-4 py-2.5 border border-red-200 text-red-700 bg-white hover:bg-red-50 text-xs font-semibold rounded-full transition"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleRespond(selectedQuote.id, "accept")}
                          disabled={processingId !== null}
                          className="px-5 py-2.5 bg-brand-chocolate text-brand-cream hover:opacity-90 text-xs font-bold uppercase tracking-widest rounded-full transition shadow-xs flex items-center space-x-1"
                        >
                          {processingId === selectedQuote.id ? (
                            <span>Working...</span>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-400" />
                              <span>Accept & Confirm Bake</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : selectedQuote.status === "Accepted" ? (
                  <div className="mt-4 p-5 bg-green-50 text-green-800 border border-green-250 rounded-2xl text-xs space-y-1.5 font-medium">
                    <p className="font-bold flex items-center gap-1.5 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      This Quote Proposal Has Been Accepted!
                    </p>
                    <p>
                      Accepted at a custom budget total of <strong className="text-brand-chocolate text-sm shadow-highlight font-sans">${selectedQuote.priceProposal?.toFixed(2)}</strong>. This project has been integrated into Lainie's active baking scheduler as a Confirmed order.
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Lainie will reach out directly to coordinate final packaging, delivery alignment, or custom text revisions if any!
                    </p>
                  </div>
                ) : selectedQuote.status === "Declined" ? (
                  <div className="mt-4 p-5 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-xs font-medium">
                    <p className="font-bold">Estimate Proposal Declined</p>
                    <p className="mt-1">
                      You have declined this pricing scenario. If you want to refine or discuss alternative budget constraints (e.g. single tier or alternative cupcake counts), please draft a fresh quote builder request!
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-5 bg-yellow-50 text-yellow-800 border border-yellow-250 rounded-2xl text-xs leading-relaxed space-y-1 font-medium">
                    <p className="font-bold flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      Lainie is Reviewing This Design Request
                    </p>
                    <p>
                      Her current response notice queue is 24-48 hours. Once ready, her custom pricing details and structural tiers breakdown will display right here in the portal. We will text or email a notify alert!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-brand-pink/40 rounded-[2.5rem] p-16 text-center text-brand-chocolate/50 flex flex-col items-center justify-center">
                <FileText className="h-10 w-10 text-brand-pink mb-3" />
                <p className="text-sm font-semibold">Select a quote from the column list to inspect detail sheets</p>
                <p className="text-xs text-gray-400 mt-1">You can accept proposals, decline alternative pricing, or review special design notes.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
