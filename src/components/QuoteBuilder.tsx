import React, { useState } from "react";
import { Sparkles, HelpCircle, Calendar, Users, DollarSign, CheckCircle2, User, Mail, Phone, AlertTriangle } from "lucide-react";

export default function QuoteBuilder() {
  const [eventType, setEventType] = useState("Wedding Reception");
  const [eventDate, setEventDate] = useState("");
  const [servings, setServings] = useState(50);
  const [flavorPreferences, setFlavorPreferences] = useState("");
  const [designIdeas, setDesignIdeas] = useState("");
  const [budgetRange, setBudgetRange] = useState("$200 - $350");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [createdQuote, setCreatedQuote] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const eventTypesList = [
    "Wedding Reception",
    "Birthday Bash",
    "Baby Shower/Gender Reveal",
    "Anniversary Celebration",
    "Corporate Event/Gala",
    "Holiday Party",
    "Everyday Celebration"
  ];

  const budgetRangesList = [
    "Under $150 (Simple treats/tray)",
    "$150 - $300 (Custom single/double tier)",
    "$300 - $500 (Detailed multi-tier cake)",
    "$500 - $1,000+ (Grand wedding / Large dessert bar)",
    "Not sure / Let Lainie propose"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setCreatedQuote(null);

    if (!eventDate) {
      setErrorMessage("Please select your event date.");
      return;
    }

    setSubmitting(true);

    const payload = {
      eventType,
      eventDate,
      servings: Number(servings),
      flavorPreferences,
      designIdeas,
      budgetRange,
      contactName,
      contactEmail,
      contactPhone,
      notes: additionalNotes,
      status: "Pending Review"
    };

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedQuote(data);
        // Clear form
        setEventDate("");
        setFlavorPreferences("");
        setDesignIdeas("");
        setContactName("");
        setContactEmail("");
        setContactPhone("");
        setAdditionalNotes("");
      } else {
        setErrorMessage(data.error || "Failed to submit quote request. Please review your fields.");
      }
    } catch (err) {
      setErrorMessage("Communication issue. Please try calling Lainie instead!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="quote-builder-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Introduction text */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="bg-brand-pink/60 text-brand-chocolate px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Handcrafted Bespoke Designs
        </span>
        <h2 className="text-4xl mt-3 text-brand-chocolate font-bold tracking-tight font-heading">
          Bespoke Event <span className="italic font-normal text-brand-rosegold">Quote Request</span>
        </h2>
        <p className="mt-2.5 text-xs text-brand-chocolate/75 leading-relaxed">
          Dreaming of a multi-tiered fondant masterwork, customized cupcakes matching your wedding blush palette, or hundreds of gourmet cookies individually stamped? Submit continuous details here! Lainie will draft custom itemizations and text or email your portal proposal link.
        </p>
      </div>

      <div className="bg-white border border-brand-rosegold/10 rounded-[2.5rem] p-6 sm:p-10 shadow-sm">
        {createdQuote ? (
          <div className="text-center py-8 max-w-md mx-auto space-y-4 animate-in zoom-in duration-300">
            <div className="mx-auto bg-green-50 text-green-600 p-4 rounded-full w-fit">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-bold text-brand-chocolate font-heading italic">
              Quote Request Logged!
            </h3>
            <p className="text-xs text-brand-chocolate/85">
              Your request reference is <strong className="text-brand-rosegold text-sm">{createdQuote.quoteNumber}</strong>.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              We have filed your custom request successfully under <strong className="text-brand-chocolate">{createdQuote.contactEmail}</strong>. Lainie will review your date criteria (<strong className="text-brand-chocolate">{createdQuote.eventDate}</strong>) and design ideas, and post a professional price proposal inside 48 hours.
            </p>
            <div className="p-3.5 bg-brand-pink/25 rounded-2xl text-[11px] text-brand-chocolate border border-brand-pink/30">
              💡 <strong>Tip:</strong> You can review, accept, or decline this quote dynamically inside the <strong>Interactive Client Portal</strong> tab using your email!
            </div>
            <button
              onClick={() => setCreatedQuote(null)}
              className="mt-4 bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition"
            >
              Submit Another Quote Request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg italic font-medium font-heading text-brand-chocolate pb-3 border-b border-brand-pink/20">
              Tell Us About Your Celebration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Event Type */}
              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5">
                  1. Celebration Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                >
                  {eventTypesList.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Event Date */}
              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5">
                  2. Requested Event Date
                </label>
                <div className="relative">
                  <Calendar className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>

              {/* Servings */}
              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5 flex justify-between">
                  <span>3. Expected Guests / Servings</span>
                  <span className="text-brand-rosegold font-bold">{servings} servings</span>
                </label>
                <div className="relative flex items-center space-x-2">
                  <Users className="h-4 w-4 text-brand-chocolate/40" />
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="5"
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    className="w-full accent-brand-rosegold"
                  />
                </div>
              </div>

              {/* Budget Range */}
              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5">
                  4. Intended Budget Target
                </label>
                <div className="relative">
                  <DollarSign className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                  <select
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  >
                    {budgetRangesList.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Design & Flavors Textareas */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5">
                  5. Flavor & Tier Preferences
                </label>
                <textarea
                  rows={2}
                  required
                  value={flavorPreferences}
                  onChange={(e) => setFlavorPreferences(e.target.value)}
                  placeholder="E.g., Vanilla cake with fresh strawberry filling and pink vanilla buttercream icing, chocolate cupcakes with cream cheese icing, etc."
                  className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1.5">
                  6. Custom Design Ideas, Colors, Theme
                </label>
                <textarea
                  rows={3}
                  required
                  value={designIdeas}
                  onChange={(e) => setDesignIdeas(e.target.value)}
                  placeholder="E.g., Three-tier rustic wedding design. Off-white frosting texture with real lavender floral sprigs on the side. Gold lettering accent."
                  className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>
            </div>

            {/* Customer Details */}
            <h3 className="text-lg font-bold text-brand-chocolate pt-4 pb-3 border-b border-brand-pink/10">
              Your Contact Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">Your Name</label>
                <div className="relative">
                  <User className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Sarah Jenkins"
                    className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="sarah.j@gmail.com"
                    className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="469-555-9876"
                    className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">Additional Special Instructions (e.g. Allergies)</label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Severe tree nut allergy, etc."
                className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
              />
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-rosegold text-white hover:bg-brand-rosegold/90 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 shadow-[0_4px_14px_rgba(183,110,121,0.3)] disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-white"></div>
                  <span>Saving Custom Request Specs...</span>
                </>
              ) : (
                <span className="flex items-center space-x-1">
                  <Sparkles className="h-4 w-4 text-yellow-300" />
                  <span>Submit Bespoke Quote Request</span>
                </span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
