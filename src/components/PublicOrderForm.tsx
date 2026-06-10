import React, { useState, useEffect } from "react";
import { Product, OrderItem, SelectedOptions, Settings, BlockedDate } from "../types";
import { ShoppingBag, Sparkles, Calendar, User, Phone, Mail, MapPin, Truck, AlertTriangle, CheckCircle, Trash2, ChevronRight } from "lucide-react";

interface PublicOrderFormProps {
  onSwitchToQuote: () => void;
}

export default function PublicOrderForm({ onSwitchToQuote }: PublicOrderFormProps) {
  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Cart state
  const [cart, setCart] = useState<OrderItem[]>([]);
  
  // Checkout form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [fulfillmentDate, setFulfillmentDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  
  // Selection helpers for active product
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [choiceSize, setChoiceSize] = useState<string>("");
  const [choiceFlavor, setChoiceFlavor] = useState<string>("");
  const [choiceAddOns, setChoiceAddOns] = useState<string[]>([]);
  const [choiceQty, setChoiceQty] = useState<number>(1);

  // Status/Notice states
  const [loading, setLoading] = useState(true);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load public details
  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, sRes, bRes] = await Promise.all([
          fetch("/api/public/menu"),
          fetch("/api/settings"),
          fetch("/api/blocked-dates")
        ]);
        if (pRes.ok) setProducts(await pRes.json());
        if (sRes.ok) setSettings(await sRes.json());
        if (bRes.ok) setBlockedDates(await bRes.json());
      } catch (err) {
        console.error("Error loading shop catalog data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Set default configurations when a product is clicked
  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setChoiceSize(p.options.sizes && p.options.sizes.length > 0 ? p.options.sizes[0].name : "");
    setChoiceFlavor(p.options.flavors && p.options.flavors.length > 0 ? p.options.flavors[0] : "");
    setChoiceAddOns([]);
    setChoiceQty(1);
    setErrorMessage("");
  };

  // Live item total calculation
  const getSelectedProductPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.basePrice;
    
    if (choiceSize && selectedProduct.options.sizes) {
      const sizeObj = selectedProduct.options.sizes.find(s => s.name === choiceSize);
      if (sizeObj) price += sizeObj.priceAdd;
    }
    
    if (selectedProduct.options.addOns) {
      choiceAddOns.forEach(addOnName => {
        const addOnObj = selectedProduct.options.addOns?.find(a => a.name === addOnName);
        if (addOnObj) price += addOnObj.priceAdd;
      });
    }

    return price;
  };

  const handleAddToBag = () => {
    if (!selectedProduct) return;
    
    const unitPrice = getSelectedProductPrice();
    const itemTotal = unitPrice * choiceQty;

    const cartItem: OrderItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: choiceQty,
      size: choiceSize || undefined,
      flavor: choiceFlavor || undefined,
      addOns: choiceAddOns.length > 0 ? choiceAddOns : undefined,
      unitPrice,
      totalPrice: itemTotal
    };

    setCart([...cart, cartItem]);
    setSelectedProduct(null); // close selection visualizer
  };

  const handleRemoveFromBag = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Computed Cart metrics
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxRate = settings?.taxRate || 0.0825;
  const cartTax = parseFloat((cartSubtotal * taxRate).toFixed(2));
  const deliveryCost = fulfillmentType === "delivery" ? (settings?.deliveryFeePerMile ? settings.deliveryRadius * settings.deliveryFeePerMile : 15.00) : 0;
  const cartTotal = parseFloat((cartSubtotal + cartTax + deliveryCost).toFixed(2));

  // Determine minimum available date based on lead time settings
  const getMinFulfillmentDate = () => {
    const minDays = settings?.leadTimeDays || 3;
    const d = new Date();
    d.setDate(d.getDate() + minDays);
    return d.toISOString().slice(0, 10);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessOrder(null);

    // Guard rails
    if (cart.length === 0) {
      setErrorMessage("Please select at least one sweet treat before checking out!");
      return;
    }
    if (!fulfillmentDate) {
      setErrorMessage("Please pick a desired fulfillment date.");
      return;
    }

    // Dynamic warning block checking
    const isDateBlocked = blockedDates.some(b => b.date === fulfillmentDate);
    if (isDateBlocked) {
      const blockedObj = blockedDates.find(b => b.date === fulfillmentDate);
      setErrorMessage(`Sorry, ${fulfillmentDate} is unavailable for orders: "${blockedObj?.notes || "Fully Booked / Holiday"}". Please choose another date.`);
      return;
    }

    setSubmitting(true);

    const payload = {
      customerName,
      customerEmail,
      customerPhone,
      items: cart,
      subtotal: cartSubtotal,
      tax: cartTax,
      deliveryFee: deliveryCost,
      total: cartTotal,
      fulfillmentDate,
      type: fulfillmentType,
      deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : "",
      notes: specialNotes
    };

    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessOrder(data);
        setCart([]);
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setFulfillmentDate("");
        setDeliveryAddress("");
        setSpecialNotes("");
      } else {
        setErrorMessage(data.error || "Something went wrong. Please check your order criteria.");
      }
    } catch (err) {
      setErrorMessage("Network error connecting to Lainie's Bake Shop. Please dial 214-555-CAKE!");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["All", "Custom Cakes", "Cupcakes", "Cookies", "Cake Pops", "Dessert Trays", "Seasonal Specials"];
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-brand-cream/30">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-rosegold"></div>
        <p className="mt-4 text-brand-chocolate/70 font-medium">Loading delicious options...</p>
      </div>
    );
  }

  return (
    <div id="shop-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Introduction Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF5EE] via-[#FFF8F0] to-[#FDF0EE] border border-brand-pink/30 rounded-[3rem] p-8 md:p-12 shadow-xs text-center max-w-4xl mx-auto mb-12 animate-in fade-in duration-300">
        {/* Background Sparkles */}
        <div className="absolute top-4 left-4 text-brand-pink/40"><Sparkles className="h-8 w-8" /></div>
        <div className="absolute bottom-4 right-4 text-brand-pink/40"><Sparkles className="h-8 w-8" /></div>
        
        {/* Logo and Greeting */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-brand-pink bg-white shadow-sm p-1.5 hover:scale-105 transition-transform duration-300">
            <img 
              src="https://images.squarespace-cdn.com/content/v1/6a0b183aaec8f87f9644a515/4a01bf37-b09f-4987-8495-e4876d754270/ChatGPT+Image+May+19%2C+2026%2C+09_01_51+AM.png?format=1500w" 
              alt="Lainie's Sweet Treats Logo" 
              className="h-full w-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <span className="bg-brand-rosegold/10 text-brand-rosegold px-4.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest border border-brand-rosegold/20">
            Welcome to Lainie's Kitchen
          </span>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl text-brand-chocolate font-black tracking-tight font-heading leading-tight">
            Lainie's <span className="italic font-normal text-brand-rosegold">Bespoke Bakery Menu</span>
          </h2>
          
          <p className="max-w-xl text-sm md:text-base text-brand-chocolate/85 leading-relaxed font-semibold">
            Based right here in <strong className="text-brand-rosegold font-black font-sans">Royse City, TX</strong>, Lainie custom-bakes every celebration treat completely from scratch with local ingredients. Experience personalized sizing, bespoke flavor options, and custom buttercream artistry!
          </p>
        </div>

        {/* Custom Event Redirection Link */}
        <div className="mt-8 p-6 bg-white/70 backdrop-blur-xs border border-brand-pink/40 rounded-[2.2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs text-left max-w-2xl mx-auto">
          <div>
            <h4 className="text-sm font-extrabold text-brand-chocolate uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-rosegold animate-pulse shrink-0" />
              Planning a wedding or major event?
            </h4>
            <p className="text-xs text-brand-chocolate/75 mt-1 font-bold leading-normal">
              Need multi-tiered designs, custom color coordination, or complex buttercream styling?
            </p>
          </div>
          <button
            onClick={onSwitchToQuote}
            className="w-full sm:w-auto bg-brand-rosegold text-white text-xs uppercase tracking-widest px-6 py-3.5 rounded-full font-black hover:bg-brand-rosegold/90 transition-all shadow-sm shrink-0 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>Quote Builder</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Catalog list (takes 2/3 space of desk) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Categories Tab selector and Search Bar */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-brand-pink/30 rounded-[2rem] shadow-xs">
              <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none flex-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-all duration-250 cursor-pointer ${
                      activeCategory === cat 
                        ? "bg-brand-chocolate text-brand-cream shadow-xs" 
                        : "bg-brand-cream/50 border border-brand-pink/10 text-brand-chocolate/80 hover:bg-brand-pink/30"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              
              <div className="relative shrink-0 w-full md:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sweet treats..."
                  className="w-full bg-brand-cream/30 border border-brand-pink/20 text-xs text-brand-chocolate font-bold px-4 py-3 rounded-full pl-9 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/50 placeholder-brand-chocolate/40"
                />
                <svg className="h-4 w-4 text-brand-chocolate/50 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-3 text-brand-chocolate/60 hover:text-brand-chocolate text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {searchQuery && (
              <p className="text-xs text-brand-chocolate/70 pl-2 font-semibold">
                Showing results for "<span className="text-brand-rosegold font-bold">{searchQuery}</span>" ({filteredProducts.length} items found)
              </p>
            )}
          </div>

          {/* Product Items grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-brand-pink/20 rounded-[2.5rem] p-12 text-center space-y-4 shadow-2xs">
              <div className="text-4xl">🧁🔍</div>
              <h3 className="text-lg font-bold text-brand-chocolate font-heading italic">No sweet matches found!</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed font-semibold">
                We couldn't locate any treats named "<strong className="text-brand-rosegold font-bold font-sans">{searchQuery}</strong>". Try clicking another category tab or check back later!
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All");
                }}
                className="bg-brand-chocolate text-brand-cream px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-all cursor-pointer"
              >
                Reset Menu Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  className="bg-white border border-brand-pink/15 rounded-[2.2rem] overflow-hidden shadow-xs hover:shadow-md hover:border-brand-pink/30 hover:scale-[1.01] transition-all duration-300 flex flex-col group"
                >
                  <div className="relative h-56 bg-brand-pink/10 overflow-hidden">
                    <img 
                      src={p.imgUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587"} 
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs text-brand-chocolate px-4 py-1.5 rounded-full text-sm font-black border border-brand-pink/20 shadow-xs">
                      From ${p.basePrice.toFixed(2)}
                    </div>
                  </div>

                  <div className="p-6.5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-brand-rosegold font-black bg-brand-pink/20 px-3.5 py-1.5 rounded-full border border-brand-pink/30">
                        {p.category}
                      </span>
                      <h3 className="text-lg lg:text-xl font-black text-brand-chocolate mt-3 leading-tight font-heading">
                        {p.name}
                      </h3>
                      <p className="text-xs text-brand-chocolate/75 mt-2 line-clamp-3 leading-relaxed font-medium">
                        {p.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-brand-pink/10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleProductSelect(p)}
                        className="w-full bg-brand-cream/50 hover:bg-brand-pink/40 text-brand-chocolate border border-brand-pink/20 py-3 rounded-full text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        <ShoppingBag className="h-4 w-4 text-brand-rosegold" />
                        <span>Place & Configure Order</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CUSTOMIZABLE SELECTION MODAL PANELS (IF PRODUCT SELECTED) */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-brand-chocolate/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[2.5rem] max-w-lg w-full max-h-[90vh] overflow-y-auto border border-brand-pink/30 p-8 shadow-xl relative animate-in fade-in duration-300">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-5 right-5 text-brand-chocolate/60 hover:text-brand-chocolate text-xl font-bold p-1"
                >
                  ✕
                </button>
                
                <h3 className="text-xl font-bold text-brand-chocolate font-heading italic">
                  Configure Your treats
                </h3>
                <p className="text-xs text-brand-rosegold font-bold uppercase tracking-wider mt-1">
                  {selectedProduct.name}
                </p>

                {/* Sizes Radio selections */}
                {selectedProduct.options?.sizes && selectedProduct.options.sizes.length > 0 && (
                  <div className="mt-5">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                      1. Highlight Size / Serving Count:
                    </label>
                    <div className="space-y-2">
                       {selectedProduct.options.sizes.map(sz => (
                        <label 
                          key={sz.name}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            choiceSize === sz.name 
                              ? "bg-brand-pink/20 border-brand-rosegold font-semibold" 
                              : "border-gray-100 hover:bg-brand-cream/50"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input 
                              type="radio" 
                              name="options-sizes"
                              checked={choiceSize === sz.name}
                              onChange={() => setChoiceSize(sz.name)}
                              className="accent-brand-rosegold"
                            />
                            <span>{sz.name}</span>
                          </div>
                          <span className="text-brand-rosegold font-semibold">
                            {sz.priceAdd > 0 ? `+$${sz.priceAdd.toFixed(2)}` : "Included"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flavors selections */}
                {selectedProduct.options?.flavors && selectedProduct.options.flavors.length > 0 && (
                  <div className="mt-5">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                      2. Selected Flavor Preference:
                    </label>
                    <select
                      value={choiceFlavor}
                      onChange={(e) => setChoiceFlavor(e.target.value)}
                      className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    >
                      {selectedProduct.options.flavors.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* AddOns checkboxes */}
                {selectedProduct.options?.addOns && selectedProduct.options.addOns.length > 0 && (
                  <div className="mt-5">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                      3. Premium Add-ons / Embellishments:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProduct.options.addOns.map(add => (
                        <label 
                          key={add.name}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            choiceAddOns.includes(add.name)
                              ? "bg-brand-pink/20 border-brand-rosegold font-semibold"
                              : "border-gray-50 hover:bg-brand-cream/30"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <input 
                              type="checkbox"
                              checked={choiceAddOns.includes(add.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setChoiceAddOns([...choiceAddOns, add.name]);
                                } else {
                                  setChoiceAddOns(choiceAddOns.filter(x => x !== add.name));
                                }
                              }}
                              className="accent-brand-rosegold"
                            />
                            <span>{add.name}</span>
                          </div>
                          <span className="text-[10px] text-brand-rosegold font-bold">
                            +${add.priceAdd}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity and Checkout action */}
                <div className="mt-6 pt-4 border-t border-brand-pink/10 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setChoiceQty(Math.max(1, choiceQty - 1))}
                      className="bg-brand-cream hover:bg-brand-pink px-2.5 py-1 rounded-md text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{choiceQty}</span>
                    <button 
                      onClick={() => setChoiceQty(choiceQty + 1)}
                      className="bg-brand-cream hover:bg-brand-pink px-2.5 py-1 rounded-md text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] text-brand-chocolate/60 block uppercase font-medium">Bake Unit Price</span>
                    <span className="text-lg font-bold text-brand-rosegold">
                      ${(getSelectedProductPrice() * choiceQty).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-brand-chocolate py-2.5 rounded-full text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToBag}
                    className="flex-1 bg-brand-rosegold hover:bg-brand-rosegold/90 text-white py-2.5 rounded-full text-xs font-semibold transition shadow-xs"
                  >
                    Add to Baking Bag
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Cart & Checkout form (takes 1/3 desk space) */}
        <div id="shop-cart" className="bg-white border border-brand-rosegold/10 rounded-[2.5rem] p-8 shadow-sm h-fit">
          <h3 className="text-xl font-bold text-brand-chocolate flex items-center space-x-2 font-heading">
            <ShoppingBag className="h-5 w-5 text-brand-rosegold" />
            <span>Your Sweet Bag</span>
          </h3>

          {/* Cart Contents */}
          {cart.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-brand-chocolate/50 font-medium">No goods added to your bag yet.</p>
              <p className="text-[11px] text-brand-rosegold mt-1">Select customizable items from Lainie's catalog on the left to start your order!</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4 max-h-60 overflow-y-auto pr-1">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs border-b border-brand-pink/10 pb-3">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-chocolate">
                        {item.quantity}x {item.name}
                      </span>
                      <button 
                        onClick={() => handleRemoveFromBag(idx)}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {item.size && (
                      <p className="text-[10px] text-brand-chocolate/65 mt-0.5">
                        Size: {item.size}
                      </p>
                    )}
                    {item.flavor && (
                      <p className="text-[10px] text-brand-chocolate/65">
                        Flavor: {item.flavor}
                      </p>
                    )}
                    {item.addOns && item.addOns.length > 0 && (
                      <p className="text-[10px] text-brand-rosegold">
                        Add-ons: {item.addOns.join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-brand-chocolate shrink-0">
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Delivery Type Option tabs */}
          {cart.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setFulfillmentType("pickup")}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  fulfillmentType === "pickup" 
                    ? "bg-brand-pink/30 border-brand-rosegold text-brand-chocolate" 
                    : "border-gray-100 text-brand-chocolate/60 hover:bg-brand-cream/30"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-brand-rosegold" />
                <span>Store Pickup</span>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType("delivery")}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  fulfillmentType === "delivery" 
                    ? "bg-brand-pink/30 border-brand-rosegold text-brand-chocolate" 
                    : "border-gray-100 text-brand-chocolate/60 hover:bg-brand-cream/30"
                }`}
              >
                <Truck className="h-3.5 w-3.5 text-brand-rosegold" />
                <span>Local Delivery</span>
              </button>
            </div>
          )}

          {/* Cart Cost summary breakdown */}
          {cart.length > 0 && (
            <div className="mt-5 space-y-1.5 text-xs pt-4 border-t border-brand-pink/10">
              <div className="flex justify-between text-brand-chocolate/85">
                <span>Subtotal:</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-brand-chocolate/85">
                <span>TX Sales Tax ({(taxRate * 100).toFixed(2)}%):</span>
                <span>${cartTax.toFixed(2)}</span>
              </div>
              {fulfillmentType === "delivery" && (
                <div className="flex justify-between text-brand-chocolate/85">
                  <span>Delivery (within {settings?.deliveryRadius || 15} miles):</span>
                  <span>${deliveryCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-brand-chocolate pt-2 border-t border-brand-pink/10">
                <span>Total Amount:</span>
                <span className="text-brand-rosegold">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Checkout Info Form */}
          {cart.length > 0 && (
            <form onSubmit={handleCheckout} className="mt-6 space-y-3 pt-4 border-t border-brand-pink/10">
              <h4 className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1">
                Fulfillment details
              </h4>

              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Full Name</label>
                <div className="relative mt-1">
                  <User className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Rebecca Davis"
                    className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl pl-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Email</label>
                  <div className="relative mt-1">
                    <Mail className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="rebecca@gmail.com"
                      className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl pl-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Phone</label>
                  <div className="relative mt-1">
                    <Phone className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="469-555-1234"
                      className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl pl-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    />
                  </div>
                </div>
              </div>

              {fulfillmentType === "delivery" && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Delivery Address (Royse City Local)</label>
                  <div className="relative mt-1">
                    <MapPin className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                    <input
                      type="text"
                      required={fulfillmentType === "delivery"}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="104 Elm St, Royse City, TX"
                      className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl pl-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block flex items-center justify-between">
                  <span>Fulfillment Date Choice</span>
                  <span className="text-[8px] text-brand-rosegold font-bold">Requires {settings?.leadTimeDays || 3} days notice</span>
                </label>
                <div className="relative mt-1">
                  <Calendar className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3" />
                  <input
                    type="date"
                    required
                    min={getMinFulfillmentDate()}
                    value={fulfillmentDate}
                    onChange={(e) => setFulfillmentDate(e.target.value)}
                    className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl pl-8 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Add-on notes / Custom writing requests</label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="E.g., Allergen alerts, specific lettering colors: 'Happy Birthday Sarah!'"
                  rows={2}
                  className="w-full text-xs bg-brand-cream/25 border border-brand-pink/15 rounded-xl p-3 mt-1 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>

              {/* Status and Submission */}
              {errorMessage && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-[11px] font-medium flex items-start space-x-2 border border-red-150 animate-bounce">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 py-3 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-b border-brand-cream"></div>
                    <span>Booking Your Baking Spot...</span>
                  </>
                ) : (
                  <span>Submit Order request (Pending Confirmation)</span>
                )}
              </button>
            </form>
          )}

          {/* Success Dialog */}
          {successOrder && (
            <div className="mt-5 p-4 bg-green-50 text-green-800 border border-green-150 rounded-2xl text-xs animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center space-x-2 font-bold mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Sweet Order Received!</span>
              </div>
              <p className="mt-1">
                Your order number is <strong className="text-brand-chocolate">{successOrder.orderNumber}</strong>.
              </p>
              <p className="mt-1 text-gray-700">
                Lainie will review your date (<strong className="text-brand-chocolate">{successOrder.fulfillmentDate}</strong>) and special notes, and text or email a confirmation soon with payment guidelines. Thank you!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
