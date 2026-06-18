import React, { useState } from "react";
import { Sparkles, HelpCircle, Calendar, Users, DollarSign, CheckCircle2, User, Mail, Phone, AlertTriangle, Layers, Palette, Eye, ArrowLeft, ArrowRight, Truck } from "lucide-react";

export default function QuoteBuilder() {
  const [step, setStep] = useState(1);

  // Step 1: Base Customizer
  const [servingsOption, setServingsOption] = useState<"10-15" | "15-20" | "20-30" | "30+">("10-15");
  const [layers, setLayers] = useState<"2" | "3" | "4">("2");
  const [flavor, setFlavor] = useState("Classic Vanilla Bean");

  // Step 2: Decorative Criteria
  const [colors, setColors] = useState("");
  const [texture, setTexture] = useState("smooth buttercream");
  const [decorStyle, setDecorStyle] = useState<"none" | "buttercream draw" | "fondant toppers" | "real flowers">("none");
  const [designNotes, setDesignNotes] = useState("");

  // Step 3: Event Logistics & Contact
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [allergyNotes, setAllergyNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [createdQuote, setCreatedQuote] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // servings numerical defaults mapping for database field
  const servingsMapNum = {
    "10-15": 12,
    "15-20": 18,
    "20-30": 25,
    "30+": 40
  };

  // Base pricing logic as specified
  const getBasePrice = () => {
    switch (servingsOption) {
      case "10-15": return 65;
      case "15-20": return 95;
      case "20-30": return 140;
      case "30+": return 185;
    }
  };

  const getLayersCost = () => {
    if (layers === "3") return 15;
    if (layers === "4") return 30;
    return 0;
  };

  const getDecorCost = () => {
    switch (decorStyle) {
      case "buttercream draw": return 25;
      case "fondant toppers": return 45;
      case "real flowers": return 35;
      default: return 0;
    }
  };

  const estimatedPrice = getBasePrice() + getLayersCost() + getDecorCost();

  // Lead time dates safety validator (7 days out)
  const getMinDateString = () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    return minDate.toISOString().slice(0, 10);
  };

  const isLeadTimeViolated = () => {
    if (!eventDate) return false;
    const chosen = new Date(eventDate);
    const minSafe = new Date();
    minSafe.setDate(minSafe.getDate() + 7);
    minSafe.setHours(0, 0, 0, 0);
    return chosen < minSafe;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setCreatedQuote(null);

    if (isLeadTimeViolated()) {
      setErrorMessage("Please select an event date at least 7 days out of lead time bounds.");
      return;
    }

    if (deliveryType === "delivery" && !deliveryAddress.trim()) {
      setErrorMessage("Please enter your local delivery address.");
      return;
    }

    setSubmitting(true);

    // Structure cake choices into serializations
    const serializedDesignIdeas = `
🍰 CUSTOM CAKE CONFIGURATION DESIGN SHEET
-----------------------------------------
• Expected Servings: ${servingsOption} (${servingsMapNum[servingsOption]} servings)
• Number of Tiers/Layers: ${layers} stacked layers
• Recipe Base Flavor: ${flavor}
• Client Color Palette ideas: ${colors || 'Not specified'}
• Frosting Texture finish: ${texture}
• Ornament Style: ${decorStyle === 'none' ? 'Standard Minimal piping' : decorStyle}
• Special design directions: ${designNotes || 'None declared'}
    `.trim();

    const serializedNotes = `
🚚 LOGISTICS & ALLERGY DISCLOSURES
-----------------------
• Logistics Mode: ${deliveryType === 'delivery' ? `Local delivery to: ${deliveryAddress}` : 'In-store Pickup'}
• Allergy specifications: ${allergyNotes || 'Precautionary notes: None declared'}
    `.trim();

    const payload = {
      eventType: "Custom Cake Intake",
      eventDate,
      servings: servingsMapNum[servingsOption],
      flavorPreferences: flavor,
      designIdeas: serializedDesignIdeas,
      budgetRange: `Est. $${estimatedPrice}.00 Cake Estimate`,
      contactName,
      contactEmail,
      contactPhone,
      notes: serializedNotes,
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
        // Clear all states
        setStep(1);
        setColors("");
        setDesignNotes("");
        setDeliveryAddress("");
        setEventDate("");
        setContactName("");
        setContactEmail("");
         setContactPhone("");
        setAllergyNotes("");
      } else {
        setErrorMessage(data.error || "Could not log custom cake design quote request.");
      }
    } catch (err) {
      setErrorMessage("Communication issue. Please try calling Lainie instead!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="quote-builder-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Introduction */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="bg-brand-pink/60 text-brand-chocolate px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block">
          Interactive Design Platform
        </span>
        <h2 className="text-4xl mt-3 text-brand-chocolate font-bold tracking-tight font-heading">
          Create Your <span className="italic font-normal text-brand-rosegold">Dream Cake</span>
        </h2>
        <p className="mt-2.5 text-xs text-brand-chocolate/75 leading-relaxed">
          Design your custom tiers with our interactive sweet tool. Select sizes, flavors, decorative artistry, and file event details to get an instant pricing estimate!
        </p>
      </div>

      <div className="bg-white border border-brand-rosegold/10 rounded-[2.5rem] p-6 sm:p-10 shadow-sm">
        {createdQuote ? (
          <div className="text-center py-8 max-w-md mx-auto space-y-4 animate-in zoom-in duration-300">
            <div className="mx-auto bg-green-50 text-green-600 p-4 rounded-full w-fit">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-bold text-brand-chocolate font-heading italic">
              Cake Request Logged!
            </h3>
            <p className="text-xs text-brand-chocolate/85">
              Reference Proposal ID: <strong className="text-brand-rosegold text-sm">{createdQuote.quoteNumber}</strong>
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              We have filed your custom estimate under <strong className="text-brand-chocolate">{createdQuote.contactEmail}</strong>. Lainie will review your date criteria (<strong className="text-brand-chocolate">{createdQuote.eventDate}</strong>) and design ideas, and update your official portal link.
            </p>
            <div className="p-3.5 bg-brand-pink/25 rounded-2xl text-[11px] text-brand-chocolate border border-brand-pink/30">
              💡 <strong>Tip:</strong> Review and pay cake deposits on the <strong>Interactive Client Portal</strong> anytime using your email!
            </div>
            <button
              onClick={() => setCreatedQuote(null)}
              className="mt-4 bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition"
            >
              Design Another Custom Cake
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Steps breadcrumb indicator */}
            <div className="flex items-center justify-between pb-4 border-b border-brand-pink/20">
              <div className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-[#3E2723]">
                <Sparkles className="h-4 w-4 text-brand-rosegold" />
                <span>Cake Designer Progress:</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-400">
                <span className={`px-2.5 py-1 rounded-full ${step === 1 ? "bg-brand-rosegold text-white" : "bg-brand-cream/50 text-brand-chocolate/70"}`}>1. Size & Base</span>
                <span>/</span>
                <span className={`px-2.5 py-1 rounded-full ${step === 2 ? "bg-brand-rosegold text-white" : "bg-brand-cream/50 text-brand-chocolate/70"}`}>2. Artistry</span>
                <span>/</span>
                <span className={`px-2.5 py-1 rounded-full ${step === 3 ? "bg-brand-rosegold text-white" : "bg-brand-cream/50 text-brand-chocolate/70"}`}>3. Logistics</span>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-center space-x-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP 1: SIZE & BASE CUSTOMIZER */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Servings sizing */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Estimate Servings Sizing Scale
                    </label>
                    <select
                      value={servingsOption}
                      onChange={(e: any) => setServingsOption(e.target.value)}
                      className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-bold text-[#3E2723]"
                    >
                      <option value="10-15">10-15 Servings (6" base tier) ($65.00)</option>
                      <option value="15-20">15-20 Servings (8" base tier) ($95.00)</option>
                      <option value="20-30">20-30 Servings (2-tier gourmet) ($140.00)</option>
                      <option value="30+">30+ Servings (Grand celebratory tiers) ($185.00)</option>
                    </select>
                  </div>

                  {/* Layers tall */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Number of Stacked Layers
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["2", "3", "4"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setLayers(lvl)}
                          className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            layers === lvl
                              ? "bg-[#B76E79] border-[#B76E79] text-white"
                              : "bg-white border-brand-pink/20 text-[#B76E79] hover:bg-brand-pink/5"
                          }`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>{lvl} Layers {lvl === "3" ? "(+$15)" : lvl === "4" ? "(+$30)" : ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipe flavor */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Recipe Core Layer Flavor
                    </label>
                    <select
                      value={flavor}
                      onChange={(e) => setFlavor(e.target.value)}
                      className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-medium text-brand-chocolate"
                    >
                      <option value="Classic Vanilla Bean">Classic Vanilla Bean (Lainie's whipped buttercream base)</option>
                      <option value="Decadent Chocolate Fudge">Decadent Chocolate Fudge (Rich dark cocoa crumbs)</option>
                      <option value="Velvet Southern Red Velvet">Velvet Southern Red Velvet (Whipped cream cheese icing)</option>
                      <option value="Zesty Meyer Lemon Berry">Zesty Meyer Lemon Berry (Organic raspberry filling)</option>
                      <option value="Salted Pecan Caramel Praline">Salted Pecan Caramel Praline (Gourmet nuts + caramel drizzle)</option>
                      <option value="Custom gourmet mix">Custom Mix Preferences (Describe in Step 2)</option>
                    </select>
                  </div>

                </div>

                <div className="flex justify-end pt-4 border-t border-brand-pink/10">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="bg-[#B76E79] text-white hover:opacity-90 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Artistry & Palette</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ARTISTRY & PALETTE */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* Colors */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Palette Color Preferences
                    </label>
                    <div className="relative">
                      <Palette className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="Blush pink, gold leaf, soft cream"
                        value={colors}
                        onChange={(e) => setColors(e.target.value)}
                        className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                      />
                    </div>
                  </div>

                  {/* Frosting texture */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#3E2723] uppercase tracking-wider block">
                      Frosting Finish Texture
                    </label>
                    <select
                      value={texture}
                      onChange={(e) => setTexture(e.target.value)}
                      className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none"
                    >
                      <option value="smooth buttercream">Polished smooth whipped buttercream</option>
                      <option value="rustic textured">Rustic textured waves</option>
                      <option value="semi-naked">Elegant Semi-naked crumb coat</option>
                      <option value="fondant wrap">Full Satin-rolled Fondant wrapping</option>
                    </select>
                  </div>

                  {/* Ornaments Accent Selection */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Special Ornaments & Accents Theme
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setDecorStyle("none")}
                        className={`p-3 border rounded-xl text-center text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          decorStyle === "none" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/15 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        <span className="text-sm font-black">Minimal Piping</span>
                        <span>Covers basic swirls</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecorStyle("buttercream draw")}
                        className={`p-3 border rounded-xl text-center text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          decorStyle === "buttercream draw" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/15 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        <span className="text-sm font-black">Drawings (+$25)</span>
                        <span>Buttercream sketches</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecorStyle("fondant toppers")}
                        className={`p-3 border rounded-xl text-center text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          decorStyle === "fondant toppers" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/15 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        <span className="text-sm font-black">Fondant (+$45)</span>
                        <span>Handmade characters</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecorStyle("real flowers")}
                        className={`p-3 border rounded-xl text-center text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          decorStyle === "real flowers" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/15 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        <span className="text-sm font-black">Flowers (+$35)</span>
                        <span>Organic botanicals</span>
                      </button>
                    </div>
                  </div>

                  {/* Design ideas notes */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Additional Design Ideas / Theme description
                    </label>
                    <textarea
                      rows={3}
                      value={designNotes}
                      onChange={(e) => setDesignNotes(e.target.value)}
                      placeholder="e.g. Needs small fondant bunny on top, matching gold leaf details on bottom layer, wedding theme..."
                      className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none"
                    />
                  </div>

                </div>

                <div className="flex justify-between pt-4 border-t border-brand-pink/10">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="border border-[#B76E79] text-[#B76E79] bg-white hover:bg-brand-pink/5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="bg-[#B76E79] text-white hover:opacity-90 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Logistics & Check</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: LOGISTICS & SUBMISSION */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* Event Date */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Requested Delivery/Event Date
                    </label>
                    <div className="relative">
                      <Calendar className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                      <input
                        type="date"
                        required
                        min={getMinDateString()}
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none"
                      />
                    </div>
                    {isLeadTimeViolated() && (
                      <p className="text-[11px] text-red-650 font-black animate-pulse">
                        ⚠️ Custom orders require at least 7 days lead time
                      </p>
                    )}
                  </div>

                  {/* Fulfillment type */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Fulfillment Logistics Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryType("pickup");
                          setDeliveryAddress("");
                        }}
                        className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          deliveryType === "pickup" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/25 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        Gift Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType("delivery")}
                        className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          deliveryType === "delivery" ? "bg-[#B76E79] border-[#B76E79] text-white" : "bg-white border-brand-pink/25 text-[#B76E79] hover:bg-brand-pink/5"
                        }`}
                      >
                        <Truck className="h-4 w-4" />
                        Local Delivery
                      </button>
                    </div>
                  </div>

                  {/* Delivery Address Field */}
                  {deliveryType === "delivery" && (
                    <div className="sm:col-span-2 space-y-2 bg-[#B76E79]/5 border border-[#B76E79]/15 p-4 rounded-2xl animate-in slide-in-from-top-1 duration-150">
                      <label className="text-xs font-bold text-[#B76E79] uppercase tracking-wider block">
                        Delivery Address in Royse City Surcharges
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="112 Bluebonnets Lane, Royse City, TX 75189"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full text-xs bg-white border border-[#B76E79]/20 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                      />
                      <p className="text-[10px] text-brand-chocolate/75 font-semibold">
                        📢 Delivery is only serviced within Royse City and adjacent 15-mile radiuses. Delivery surcharges apply.
                      </p>
                    </div>
                  )}

                  {/* Contact details */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <User className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="Elainie Coop"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        placeholder="client@mail.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Mobile Telephone (Updates)
                    </label>
                    <div className="relative">
                      <Phone className="h-4 w-4 text-brand-chocolate/40 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        required
                        placeholder="(469) 555-0321"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl pl-10 pr-4 py-3 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Allergy notes */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                      Allergy Specifications / Sensitivities
                    </label>
                    <textarea
                      rows={1}
                      value={allergyNotes}
                      onChange={(e) => setAllergyNotes(e.target.value)}
                      placeholder="e.g. Severe gluten intolerance, nut allergies..."
                      className="w-full text-xs bg-brand-cream/35 border border-brand-pink/15 rounded-xl px-4 py-3 focus:outline-none"
                    />
                  </div>

                </div>

                {/* Estimate review details box */}
                <div className="bg-brand-cream/30 border border-brand-pink/20 rounded-[2rem] p-5 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-brand-pink/10">
                    <span className="font-extrabold uppercase text-xs tracking-wider text-brand-chocolate">INTERACTIVE DESIGN SUMMARY:</span>
                    <span className="font-black text-brand-rosegold text-lg">Est. Price: ${estimatedPrice}.00</span>
                  </div>
                  <div className="grid grid-cols-2 text-[11px] text-brand-chocolate/80 gap-y-1.5 gap-x-4">
                    <p>• Size: <strong>{servingsOption} servings</strong></p>
                    <p>• Layers: <strong>{layers} layers</strong></p>
                    <p>• Recipe Flavor: <strong>{flavor}</strong></p>
                    <p>• Frosting Finish: <strong>{texture}</strong></p>
                    <p>• Decorative Art: <strong>{decorStyle === 'none' ? 'Standard Swirls' : decorStyle}</strong></p>
                    <p>• Logistics: <strong>{deliveryType === 'delivery' ? 'Local Hand delivery' : 'Store pickup (Free)'}</strong></p>
                  </div>
                  <p className="text-[10px] text-gray-400 italic font-semibold leading-relaxed">
                    *Estimates are dynamically calculated parameters. Lainie reviews all design criteria and details before finalizing deposit links inside the Client Portal.
                  </p>
                </div>

                <div className="flex justify-between pt-4 border-t border-brand-pink/10">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="border border-[#B76E79] text-[#B76E79] bg-white hover:bg-brand-pink/5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || isLeadTimeViolated()}
                    className="bg-[#B76E79] text-white hover:opacity-95 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    {submitting ? "Booking Custom request..." : "Submit Custom Cake Request"}
                  </button>
                </div>
              </div>
            )}

          </form>
        )}
      </div>
    </div>
  );
}
