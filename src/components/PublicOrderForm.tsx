import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Product, OrderItem, SelectedOptions, Settings, BlockedDate, OptionItem } from "../types";
import { ShoppingBag, Sparkles, Calendar, User, Phone, Mail, MapPin, Truck, AlertTriangle, CheckCircle, Trash2, ChevronRight } from "lucide-react";
import {
  normalizeProductNameAndCategory,
  normalizeProductPhotos,
  getPrimaryProductImage,
  DEFAULT_FALLBACK_IMAGE,
} from "../utils/productUtils";
import { ProductImage } from "./ProductImage";

const resolveToOptions = (rawList: (string | OptionItem)[] | undefined): OptionItem[] => {
  if (!rawList) return [];
  return rawList.map(item => {
    if (typeof item === "string") {
      return { name: item, priceAdd: 0 };
    }
    return {
      name: item.name || "",
      priceAdd: Number(item.priceAdd) || 0
    };
  });
};

interface PublicOrderFormProps {
  onSwitchToQuote: () => void;
}

interface ProductPhotoGalleryProps {
  product: Product;
  selectedVariationId?: string | null;
}

function ProductPhotoGallery({ product, selectedVariationId }: ProductPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [aspectType, setAspectType] = useState<"portrait" | "landscape" | "square">("square");

  // Normalize product photos to ensure we have a valid array
  const rawPhotos = normalizeProductPhotos(product, selectedVariationId || undefined);

  // Sort photos so that the primary image appears first in the gallery thumbnails & active photo resolution
  const sortedPhotos = [...rawPhotos].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  useEffect(() => {
    setActiveIndex(0);
    setAspectType("square");
  }, [product, selectedVariationId]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      if (ratio < 0.85) {
        setAspectType("portrait");
      } else if (ratio > 1.15) {
        setAspectType("landscape");
      } else {
        setAspectType("square");
      }
    }
  };

  let aspectClass = "aspect-square";
  if (aspectType === "portrait") {
    aspectClass = "aspect-[3/4]";
  } else if (aspectType === "landscape") {
    aspectClass = "aspect-[4/3]";
  }

  // Ensure activeIndex is valid if the photo gallery length changes
  const safeActiveIndex = activeIndex >= sortedPhotos.length ? 0 : activeIndex;
  const activePhoto = sortedPhotos[safeActiveIndex] || { url: DEFAULT_FALLBACK_IMAGE };

  return (
    <div className="space-y-2">
      <div className={`relative w-full bg-brand-pink/5 rounded-2xl overflow-hidden border border-brand-pink/15 transition-all duration-300 ${aspectClass}`}>
        <ProductImage 
          src={activePhoto.url} 
          alt={`Preview photo of ${product.name}`} 
          onLoad={handleImageLoad}
          className="w-full h-full object-cover animate-in fade-in duration-200"
        />
      </div>
      {sortedPhotos.length > 1 && (
        <div className="flex gap-2 border border-brand-pink/10 rounded-xl p-1.5 overflow-x-auto bg-brand-cream/10">
          {sortedPhotos.map((ph, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                idx === safeActiveIndex ? 'border-brand-rosegold shadow-sm' : 'border-transparent'
              }`}
            >
              <ProductImage src={ph.url} alt={`Thumbnail preview ${idx + 1} of ${product.name}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

  // Feature 5 Coupon validations
  const [enteredCoupon, setEnteredCoupon] = useState("");
  const [couponMeta, setCouponMeta] = useState<{ code: string; type: string; value: number; minOrderAmount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);
  
  // Checkout form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [fulfillmentDate, setFulfillmentDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [tipType, setTipType] = useState<"none" | "10" | "15" | "20" | "custom">("none");
  const [customTip, setCustomTip] = useState("");
  
  // Selection helpers for active product
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [choiceSize, setChoiceSize] = useState<string>("");
  const [choiceFlavor, setChoiceFlavor] = useState<string>("");
  const [choiceCakeFlavor, setChoiceCakeFlavor] = useState<string>("");
  const [choiceFrosting, setChoiceFrosting] = useState<string>("");
  const [choiceDrizzle, setChoiceDrizzle] = useState<string>("");
  const [choiceAddOns, setChoiceAddOns] = useState<string[]>([]);
  const [choiceQty, setChoiceQty] = useState<number>(1);

  // Reset variation and selections on product change
  useEffect(() => {
    if (selectedProduct) {
      setSelectedVarId(null);
      setChoiceSize("");
      setChoiceFlavor("");
      setChoiceCakeFlavor("");
      setChoiceFrosting("");
      setChoiceDrizzle("");
      setChoiceAddOns([]);
      setChoiceQty(1);
    }
  }, [selectedProduct]);

  // Status/Notice states
  const [loading, setLoading] = useState(true);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load public details and listen for category changes
  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, sRes, bRes] = await Promise.all([
          fetch("/api/public/menu"),
          fetch("/api/settings"),
          fetch("/api/blocked-dates")
        ]);
        if (pRes.ok) {
          const rawProducts = await pRes.json();
          const mapped = rawProducts.map((p: any) => {
            const { name, category } = normalizeProductNameAndCategory(p);
            const photos = normalizeProductPhotos(p);
            const imgUrl = photos.find(ph => ph.isPrimary)?.url || (photos.length > 0 ? photos[0].url : "");
            return {
              ...p,
              name,
              category,
              photos,
              imgUrl
            };
          });
          setProducts(mapped);
        }
        if (sRes.ok) setSettings(await sRes.json());
        if (bRes.ok) setBlockedDates(await bRes.json());
      } catch (err) {
        console.error("Error loading shop catalog data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Listen for custom category changes from the redesigned header
    const handleCategoryCheck = () => {
      const stored = sessionStorage.getItem("lainie_shop_category");
      if (stored) {
        setActiveCategory(stored);
      }
    };
    handleCategoryCheck();
    window.addEventListener("lainie_category_change", handleCategoryCheck);
    
    return () => {
      window.removeEventListener("lainie_category_change", handleCategoryCheck);
    };
  }, []);

  // Set default configurations when a product is clicked
  const [activePhotoUrlIndex, setActivePhotoUrlIndex] = useState(0);
  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    const hasVariations = p.variations && p.variations.length > 0;
    setChoiceSize(hasVariations ? "" : (p.options.sizes && p.options.sizes.length > 0 ? p.options.sizes[0].name : ""));
    
    let defaultFlavor = "";
    if (p.options.flavors && p.options.flavors.length > 0) {
      const f = p.options.flavors[0];
      defaultFlavor = typeof f === "string" ? f : f.name;
    }
    setChoiceFlavor(hasVariations ? "" : defaultFlavor);

    let defaultCakeFlavor = "";
    if (p.options.cakeFlavors && p.options.cakeFlavors.length > 0) {
      const cf = p.options.cakeFlavors[0];
      defaultCakeFlavor = typeof cf === "string" ? cf : cf.name;
    }
    setChoiceCakeFlavor(hasVariations ? "" : defaultCakeFlavor);

    let defaultFrosting = "";
    const activeFrostings = p.options.frostings || p.options.flavors;
    if (activeFrostings && activeFrostings.length > 0) {
      const f = activeFrostings[0];
      defaultFrosting = typeof f === "string" ? f : f.name;
    }
    setChoiceFrosting(hasVariations ? "" : defaultFrosting);
    if (!defaultFlavor && defaultFrosting) {
      setChoiceFlavor(hasVariations ? "" : defaultFrosting);
    }

    setChoiceAddOns([]);
    setChoiceQty(1);
    setErrorMessage("");
    setSelectedVarId(null);
  };

  // Live item total calculation
  const getSelectedProductPrice = () => {
    if (!selectedProduct) return 0;
    
    const activeVar = selectedProduct.variations?.find(v => v.id === selectedVarId);
    let price = activeVar ? activeVar.basePrice : selectedProduct.basePrice;

    // Size price addition
    const activeSizes = activeVar ? (activeVar.options.sizes || []) : (selectedProduct.options.sizes || []);
    if (choiceSize && activeSizes) {
      const sizeObj = activeSizes.find(s => s.name === choiceSize);
      if (sizeObj) price += sizeObj.priceAdd;
    }

    // Cake Flavor price addition
    const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : selectedProduct.options?.cakeFlavors;
    const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);
    if (choiceCakeFlavor && resolvedCakeFlavors) {
      const cakeFlavorObj = resolvedCakeFlavors.find(cf => cf.name === choiceCakeFlavor);
      if (cakeFlavorObj) price += cakeFlavorObj.priceAdd;
    }

    // Frosting price addition
    const rawFrostings = activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (selectedProduct.options?.frostings || selectedProduct.options?.flavors);
    const resolvedFrostings = resolveToOptions(rawFrostings);
    const selectedFrostingVal = choiceFrosting || choiceFlavor;
    if (selectedFrostingVal && resolvedFrostings) {
      const frostingObj = resolvedFrostings.find(f => f.name === selectedFrostingVal);
      if (frostingObj) price += frostingObj.priceAdd;
    }

    // Drizzle price addition
    const rawDrizzles = activeVar ? activeVar.options?.drizzles : selectedProduct.options?.drizzles;
    const resolvedDrizzles = resolveToOptions(rawDrizzles);
    if (choiceDrizzle && resolvedDrizzles) {
      const drizzleObj = resolvedDrizzles.find(d => d.name === choiceDrizzle);
      if (drizzleObj) price += drizzleObj.priceAdd;
    }

    // Topping price addition
    const rawToppings = activeVar 
      ? (activeVar.options?.toppings || activeVar.options?.addOns) 
      : (selectedProduct.options?.toppings || selectedProduct.options?.addOns);
    const resolvedToppings = resolveToOptions(rawToppings);
    const selectedToppingName = choiceAddOns[0];
    if (selectedToppingName && resolvedToppings) {
      const toppingObj = resolvedToppings.find(t => t.name === selectedToppingName);
      if (toppingObj) price += toppingObj.priceAdd;
    }

    return price;
  };

  const handleAddToBag = () => {
    if (!selectedProduct) return;

    if (selectedProduct.variations && selectedProduct.variations.length > 0 && !selectedVarId) {
      alert("Please select a variation (Normal or Specialty) first!");
      return;
    }
    
    const activeVar = selectedProduct.variations?.find(v => v.id === selectedVarId);
    const unitPrice = getSelectedProductPrice();
    const itemTotal = unitPrice * choiceQty;

    let sizePriceAdd = 0;
    const activeSizes = activeVar ? (activeVar.options.sizes || []) : (selectedProduct.options.sizes || []);
    if (choiceSize && activeSizes) {
      const sizeObj = activeSizes.find(s => s.name === choiceSize);
      if (sizeObj) sizePriceAdd = sizeObj.priceAdd;
    }

    const cartItem: OrderItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: choiceQty,
      size: choiceSize || undefined,
      flavor: choiceFrosting || choiceFlavor || undefined,
      selectedCakeFlavors: choiceCakeFlavor ? [choiceCakeFlavor] : undefined,
      selectedFrostings: choiceFrosting ? [choiceFrosting] : undefined,
      addOns: choiceAddOns.length > 0 ? choiceAddOns : undefined,
      selectedDrizzle: choiceDrizzle || undefined,
      unitPrice,
      totalPrice: itemTotal,
      variationId: activeVar?.id,
      variationName: activeVar?.name,
      variationBasePrice: activeVar?.basePrice,
      sizePriceAdd: sizePriceAdd
    };

    setCart([...cart, cartItem]);
    setSelectedProduct(null); // close selection visualizer
    setSelectedVarId(null);
  };

  const handleRemoveFromBag = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Computed Cart metrics with Feature 5 dynamic coupon logic
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  let calculatedDiscount = 0;
  if (couponMeta) {
    if (cartSubtotal >= couponMeta.minOrderAmount) {
      if (couponMeta.type === "percentage") {
        calculatedDiscount = parseFloat(((cartSubtotal * couponMeta.value) / 100).toFixed(2));
      } else {
        calculatedDiscount = Math.min(couponMeta.value, cartSubtotal);
      }
    }
  }

  const taxRate = settings?.taxRate || 0.0825;
  const discountedSubtotal = Math.max(0, cartSubtotal - calculatedDiscount);

  // Calculate tip value based on discounted subtotal
  let cartTipAmount = 0;
  if (tipType === "10") {
    cartTipAmount = parseFloat((discountedSubtotal * 0.10).toFixed(2));
  } else if (tipType === "15") {
    cartTipAmount = parseFloat((discountedSubtotal * 0.15).toFixed(2));
  } else if (tipType === "20") {
    cartTipAmount = parseFloat((discountedSubtotal * 0.20).toFixed(2));
  } else if (tipType === "custom") {
    const parsed = parseFloat(customTip);
    cartTipAmount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  const cartTax = parseFloat((discountedSubtotal * taxRate).toFixed(2));
  const deliveryCost = fulfillmentType === "delivery" ? (settings?.deliveryFeePerMile ? settings.deliveryRadius * settings.deliveryFeePerMile : 15.00) : 0;
  const cartTotal = parseFloat((discountedSubtotal + cartTipAmount + cartTax + deliveryCost).toFixed(2));

  const handleApplyCoupon = async () => {
    if (!enteredCoupon.trim()) return;
    setCouponError("");
    setCouponLoading(true);

    try {
      const res = await fetch("/api/public/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: enteredCoupon.toUpperCase().trim(),
          subtotal: cartSubtotal
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid promo code.");
      }

      setCouponMeta({
        code: enteredCoupon.toUpperCase().trim(),
        type: data.discountType,
        value: data.value,
        minOrderAmount: data.minOrderAmount || 0
      });
      setCouponError("");
    } catch (err: any) {
      setCouponError(err.message || "An error occurred.");
    } finally {
      setCouponLoading(false);
    }
  };

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
      cart: cart.map(item => ({
        productId: item.productId,
        variationId: item.variationId || undefined,
        quantity: item.quantity,
        size: item.size || undefined,
        selectedCakeFlavors: item.selectedCakeFlavors || undefined,
        selectedFrostings: item.selectedFrostings || undefined,
        selectedDrizzles: item.selectedDrizzle ? [item.selectedDrizzle] : undefined,
        selectedToppings: item.addOns || undefined
      })),
      fulfillmentDate,
      fulfillmentType,
      deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : "",
      notes: specialNotes,
      promoCode: couponMeta ? couponMeta.code : undefined,
      tipSelection: tipType,
      customTip: tipType === "custom" ? Number(customTip) : 0
    };

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        // Persist checkout state in sessionStorage so that we can optionally recover it
        sessionStorage.setItem("lst_last_cart", JSON.stringify(cart));
        sessionStorage.setItem("lst_last_checkout_fields", JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          fulfillmentDate,
          fulfillmentType,
          deliveryAddress,
          specialNotes,
          tipType,
          customTip,
          couponMeta
        }));
        
        // Redirect to Stripe Checkout Session
        window.location.assign(data.checkoutUrl);
      } else {
        setErrorMessage(data.error || "Something went wrong. Please check your order criteria.");
      }
    } catch (err) {
      setErrorMessage("Network error connecting to Stripe. Please try again!");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["All", "Mini Cakes", "Cupcakes", "Cookies", "Seasonal Specials"];
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
    <div id="shop-view" className="w-full animate-fade-in relative">
      {/* Premium brand-integrated Hero Section with glassmorphism filtering */}
      <div className="w-full relative z-20 pt-16 pb-16 md:pt-20 md:pb-20 text-center flex flex-col justify-between animate-in fade-in duration-500 overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          {(settings?.topBgType || "image") === "video" ? (
            <video
              src={settings?.topBgUrl || "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=1600&auto=format&fit=crop"}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ opacity: settings?.topBgOpacity !== undefined ? Number(settings.topBgOpacity) : 0.65 }}
            />
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `url("${settings?.topBgUrl || "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=1600&auto=format&fit=crop"}")`,
                opacity: settings?.topBgOpacity !== undefined ? Number(settings.topBgOpacity) : 0.65
              }}
            />
          )}
        </div>
        {/* Dark brand gradient overlay to ensure text contrast and legibility */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none select-none" 
          style={{
            background: "linear-gradient(to bottom, rgba(17,17,17,0.55) 0%, rgba(17,17,17,0.3) 45%, rgba(17,17,17,0.4) 75%, rgba(255,45,150,0.65) 100%)"
          }}
        />
        <div className="max-w-5xl mx-auto px-4 relative z-20">
          {/* Large desktop-only floating logo, absolutely positioned relative to the centered header container */}
          <div className="hidden lg:flex absolute lg:-left-[155px] xl:-left-[215px] lg:-top-[15px] xl:-top-[35px] lg:w-[130px] lg:h-[130px] xl:w-[220px] xl:h-[220px] flex-shrink-0 items-center justify-center transform-gpu hover:scale-105 transition-all duration-300 z-20">
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/lainies-sweet-treats.firebasestorage.app/o/site-assets%2F3dlogo.jpg?alt=media&token=98c5f20f-3e18-4a91-805a-6a4d145fc042"
              alt="Lainie's Sweet Treats Logo"
              className="absolute lg:w-[190px] lg:h-[190px] xl:w-[320px] xl:h-[320px] max-w-none object-cover scale-[0.68] filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              style={{
                maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 75%)',
                WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 75%)'
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Mobile-only stacked logo */}
          <div className="lg:hidden relative mx-auto mb-6 w-[150px] h-[150px] flex-shrink-0 flex items-center justify-center transform-gpu hover:scale-105 transition-all duration-300 z-20">
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/lainies-sweet-treats.firebasestorage.app/o/site-assets%2F3dlogo.jpg?alt=media&token=98c5f20f-3e18-4a91-805a-6a4d145fc042"
              alt="Lainie's Sweet Treats Logo"
              className="absolute w-[220px] h-[220px] max-w-none object-cover scale-[0.68] filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              style={{
                maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 75%)',
                WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 75%)'
              }}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Centered Headline, Subtext, and CTA Button Group */}
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <h2 
              className="text-3xl md:text-[38px] lg:text-[42px] text-brand-cream font-bold font-heading leading-tight mb-4"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)", letterSpacing: "0.8px" }}
            >
              Lainie's Bespoke Bakery Menu
            </h2>
            
            <p 
              className="text-sm md:text-base text-brand-cream/90 leading-relaxed font-normal mb-8 font-heading"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
            >
              Based in Royse City, TX. Lainie custom-bakes every celebration treat.<br />
              Experience personalized designs and custom buttercream artistry.
            </p>

            <div className="flex justify-center">
              <button
                onClick={onSwitchToQuote}
                className="bg-brand-pink text-white hover:bg-brand-rosegold hover:text-brand-chocolate text-base uppercase tracking-widest px-8 py-3.5 rounded-full font-black hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_4px_20px_rgba(255,45,150,0.3)] flex items-center justify-center space-x-2 cursor-pointer transform-gpu"
              >
                <Sparkles className="h-4 w-4 animate-pulse text-white group-hover:text-brand-chocolate" />
                <span className="text-base">REQUEST A CUSTOM QUOTE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Categories selector embedded at the bottom of the hero background portion */}
        <div className="w-full mt-10 md:mt-14 px-4 sm:px-6 lg:px-8 relative z-20">
          <div className="max-w-5xl mx-auto bg-[rgba(255,248,240,0.15)] border border-[rgba(255,248,240,0.25)] backdrop-blur-md rounded-2xl md:rounded-full p-2.5 sm:p-3 sm:px-4 shadow-lg">
            <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-1.5 sm:gap-2.5 w-full">
              {categories.map(cat => {
                const isActive = activeCategory === cat;
                
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 sm:px-4.5 py-1.5 rounded-full text-base font-semibold tracking-wider uppercase transition-all duration-300 hover:scale-105 cursor-pointer border whitespace-nowrap ${
                      isActive 
                        ? "bg-brand-pink border-brand-pink text-white shadow-md font-extrabold" 
                        : "bg-transparent border-white/35 text-white hover:bg-white/10 hover:text-brand-rosegold"
                    }`}
                  >
                    {cat === "All" ? "ALL" : cat.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Seamless sunset-style gradient transition zone overlapping the boundary by 200px */}
        <div 
          className="absolute bottom-[-100px] left-0 right-0 h-[200px] pointer-events-none z-10"
          style={{
            background: "linear-gradient(to bottom, rgba(17,17,17,0.55) 0%, rgba(255,45,150,0.55) 100%)"
          }}
        />
      </div>

      {/* Lower section with real-world bakery backdrop (blurred/filtered) */}
      <div id="storefront-content-section" className="w-full relative overflow-hidden z-10">
        {/* Background layer */}
        <div className="absolute -inset-4 pointer-events-none select-none filter blur-[3px] z-0">
          {(settings?.bottomBgType || "image") === "video" ? (
            <video
              src={settings?.bottomBgUrl || "https://firebasestorage.googleapis.com/v0/b/lainies-sweet-treats.firebasestorage.app/o/site-assets%2Fbackground2.jpg?alt=media&token=1d962c6e-eb11-4f47-b98e-3dbc5863f473"}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                opacity: settings?.bottomBgOpacity !== undefined ? Number(settings.bottomBgOpacity) : 0.15,
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
              }}
            />
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `url("${settings?.bottomBgUrl || "https://firebasestorage.googleapis.com/v0/b/lainies-sweet-treats.firebasestorage.app/o/site-assets%2Fbackground2.jpg?alt=media&token=1d962c6e-eb11-4f47-b98e-3dbc5863f473"}")`,
                backgroundAttachment: "fixed",
                opacity: settings?.bottomBgOpacity !== undefined ? Number(settings.bottomBgOpacity) : 0.15
              }}
            />
          )}
        </div>
        {/* Soft pink to warm cream gradient overlay with lower opacity to reveal the backdrop warmth */}
        <div 
          className="absolute inset-0 pointer-events-none select-none z-10"
          style={{
            background: "linear-gradient(to bottom, rgba(255,45,150,0.15) 0%, var(--color-brand-gray) 100%)"
          }}
        />

        {/* Content container layer */}
        <div className="relative z-30 max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 xl:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {/* LEFT COLUMN: Catalog list (takes 3/4 space on desktop) */}
          <div className="lg:col-span-2 xl:col-span-3 space-y-8">
            {/* Search & Product items block */}
            <div className="w-full space-y-6">
              {/* Search Bar Block */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sweet treats by name, ingredient, or category..."
                  className="w-full bg-white border border-brand-rosegold/50 text-xs sm:text-sm text-brand-chocolate px-5 py-3.5 rounded-full pl-12 focus:outline-none focus:ring-2 focus:ring-brand-pink placeholder-brand-chocolate/40 transition-all font-medium shadow-md"
                />
              <svg className="h-4.5 w-4.5 text-brand-chocolate/40 absolute left-4.5 top-4 md:top-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4.5 top-3.5 md:top-4 text-brand-chocolate/60 hover:text-brand-chocolate hover:scale-110 text-xs font-black p-1 transition-transform"
                >
                  ✕
                </button>
              )}
            </div>

            {searchQuery && (
              <p className="text-xs text-brand-chocolate/70 pl-2 font-semibold">
                Showing results for "<span className="text-brand-rosegold font-bold">{searchQuery}</span>" ({filteredProducts.length} items found)
              </p>
            )}

            {/* Product Items grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white border border-brand-pink/15 rounded-[1.5rem] p-12 text-center space-y-4 shadow-md">
                <div className="text-4xl text-brand-rosegold">🧁🔍</div>
                <h3 className="text-lg font-bold text-brand-chocolate font-heading italic">No sweet matches found!</h3>
                <p className="text-xs text-brand-chocolate/70 max-w-sm mx-auto leading-relaxed font-normal">
                  We couldn't locate any treats named "<strong>{searchQuery}</strong>". Try clicking another category tab or check back later!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("All");
                  }}
                  className="bg-brand-rosegold text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-all cursor-pointer"
                >
                  Reset Menu Filters
                </button>
              </div>
            ) : (
              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8"
              >
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map(p => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      key={p.id}
                      onClick={() => handleProductSelect(p)}
                      className="bg-white border border-brand-pink/15 rounded-[1.5rem] overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group transform-gpu cursor-pointer"
                    >
                      <div className="relative h-56 bg-brand-pink/10 overflow-hidden">
                        <ProductImage 
                          src={getPrimaryProductImage(p)} 
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute top-3 right-3 bg-brand-rosegold text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                          Starting at ${p.basePrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between items-center bg-brand-cream">
                        <div className="text-center">
                          <h3 className="font-sans font-bold text-[15px] sm:text-base text-brand-chocolate leading-tight">
                            {p.name}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductSelect(p);
                          }}
                          className="text-brand-rosegold hover:text-brand-chocolate font-bold text-xs uppercase tracking-wider underline cursor-pointer mt-3.5 transition-colors duration-200"
                        >
                          Add to Bag
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>


        </div>

        {/* RIGHT COLUMN: Interactive Cart & Checkout form */}
        <div className="lg:col-span-1">
          <div 
            id="shop-cart" 
            className="lg:sticky lg:top-32 bg-white border border-brand-pink/15 rounded-[1.5rem] p-6 shadow-md h-fit transition-all duration-300"
          >
            <div className="border-b border-brand-pink/20 pb-4 flex items-center space-x-2.5">
              <ShoppingBag className="h-5.5 w-5.5 text-brand-rosegold" />
              <h3 className="text-xl font-bold text-brand-chocolate font-heading leading-none">
                Your Sweet Bag
              </h3>
            </div>

            {/* Cart Contents */}
            {cart.length === 0 ? (
              <div className="py-12 px-4 text-center mt-5 flex flex-col items-center justify-center space-y-3">
                <ShoppingBag className="h-8 w-8 text-brand-rosegold/40" />
                <p className="text-xs text-brand-chocolate/70 leading-relaxed font-normal max-w-[200px] mx-auto">
                  Your bag is currently empty. Start adding delicious items!
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4.5 max-h-64 overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs border-b border-brand-pink/10 pb-4">
                    <div className="flex-1 pr-3">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-brand-chocolate text-xs md:text-sm">
                          {item.quantity}x {item.name}{item.variationName ? ` (${item.variationName})` : ""}
                        </span>
                        <button 
                          onClick={() => handleRemoveFromBag(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {item.size && (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold mt-1">
                          Size: {item.size}
                        </p>
                      )}
                      {item.selectedCakeFlavors && item.selectedCakeFlavors.length > 0 && (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold">
                          Cake Flavor: {item.selectedCakeFlavors.join(", ")}
                        </p>
                      )}
                      {item.selectedFrostings && item.selectedFrostings.length > 0 ? (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold">
                          Frosting: {item.selectedFrostings.join(", ")}
                        </p>
                      ) : item.flavor ? (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold">
                          Frosting: {item.flavor}
                        </p>
                      ) : null}
                      {item.selectedDrizzle && (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold">
                          Drizzle: {item.selectedDrizzle}
                        </p>
                      )}
                      {item.addOns && item.addOns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.addOns.map((add, i) => (
                            <span key={i} className="text-[9px] bg-brand-pink/15 text-brand-rosegold font-black px-2 py-0.5 rounded border border-brand-pink/20">
                              {add}
                            </span>
                          ))}
                        </div>
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
              <div className="grid grid-cols-2 gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`flex items-center justify-center space-x-1.5 py-3 rounded-2xl text-xs font-bold border-2 transition-all cursor-pointer transform-gpu active:scale-95 ${
                    fulfillmentType === "pickup" 
                      ? "bg-brand-pink/30 border-brand-rosegold text-brand-chocolate shadow-2xs font-extrabold" 
                      : "border-brand-pink/10 bg-white/50 text-brand-chocolate/65 hover:bg-brand-cream/40"
                  }`}
                >
                  <MapPin className="h-4 w-4 text-brand-rosegold" />
                  <span>Store Pickup</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType("delivery")}
                  className={`flex items-center justify-center space-x-1.5 py-3 rounded-2xl text-xs font-bold border-2 transition-all cursor-pointer transform-gpu active:scale-95 ${
                    fulfillmentType === "delivery" 
                      ? "bg-brand-pink/30 border-brand-rosegold text-brand-chocolate shadow-2xs font-extrabold" 
                      : "border-brand-pink/10 bg-white/50 text-brand-chocolate/65 hover:bg-brand-cream/40"
                  }`}
                >
                  <Truck className="h-4 w-4 text-brand-rosegold" />
                  <span>Local Delivery</span>
                </button>
              </div>
            )}

            {/* Cart Cost summary breakdown */}
            {cart.length > 0 && (
              <div className="mt-6 space-y-2 text-xs pt-4 border-t border-brand-pink/20">
                <div className="flex justify-between text-brand-chocolate/85 font-medium">
                  <span>Subtotal:</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>

                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>Promo Discount ({couponMeta?.code}):</span>
                    <span>-${calculatedDiscount.toFixed(2)}</span>
                  </div>
                )}

                {/* Interactive Tip Option Selector */}
                <div className="bg-brand-cream/30 border border-brand-pink/15 rounded-2xl p-3 my-2.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-[#3E2723] text-[10px] uppercase tracking-wider">Add a baking tip to support Lainie:</span>
                    {cartTipAmount > 0 && (
                      <span className="font-black text-brand-rosegold text-xs">+${cartTipAmount.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(["10", "15", "20"] as const).map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipType(pct);
                          setCustomTip("");
                        }}
                        className={`py-1 rounded-full text-[10px] font-extrabold border transition-all duration-300 cursor-pointer text-center hover:scale-105 ${
                          tipType === pct
                            ? "bg-brand-pink border-brand-pink text-white shadow-sm"
                            : "bg-white border-brand-rosegold text-brand-pink hover:bg-brand-pink/10"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setTipType("custom");
                        setCustomTip("");
                      }}
                      className={`py-1 rounded-full text-[10px] font-extrabold border transition-all duration-300 cursor-pointer text-center hover:scale-105 ${
                        tipType === "custom"
                          ? "bg-brand-pink border-brand-pink text-white shadow-sm"
                          : "bg-white border-brand-rosegold text-brand-pink hover:bg-brand-pink/10"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {tipType === "custom" && (
                    <div className="flex items-center space-x-1.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="text-xs text-brand-chocolate font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={customTip}
                        onChange={(e) => setCustomTip(e.target.value)}
                        className="flex-1 text-[11px] font-bold border border-brand-pink/20 bg-white text-brand-chocolate px-2.5 py-1 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-brand-chocolate/65 text-center italic mt-1 font-medium leading-none">
                    Tips are never expected but always appreciated 🍰
                  </p>
                </div>

                {cartTipAmount > 0 && (
                  <div className="flex justify-between text-brand-chocolate/85 font-medium">
                    <span>Tip ({tipType === 'custom' ? 'Custom' : `${tipType}%`}):</span>
                    <span>${cartTipAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-brand-chocolate/85 font-medium">
                  <span>TX Sales Tax ({(taxRate * 100).toFixed(2)}%):</span>
                  <span>${cartTax.toFixed(2)}</span>
                </div>
                {fulfillmentType === "delivery" && (
                  <div className="flex justify-between text-brand-chocolate/85 font-medium">
                    <span>Delivery (within {settings?.deliveryRadius || 15} miles):</span>
                    <span>${deliveryCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-brand-chocolate pt-2.5 border-t border-brand-pink/20">
                  <span>Total Amount:</span>
                  <span className="text-brand-rosegold font-black">${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Feature 5 — Coupon Code Validation Interface */}
            {cart.length > 0 && (
              <div className="mt-5 pt-4 border-t border-brand-pink/20 space-y-3">
                {!showCouponInput && !couponMeta && (
                  <button
                    type="button"
                    onClick={() => setShowCouponInput(true)}
                    className="text-xs font-bold text-brand-rosegold hover:text-brand-chocolate hover:underline transition cursor-pointer"
                  >
                    Have a promo/coupon code?
                  </button>
                )}

                {(showCouponInput || couponMeta) && (
                  <div className="space-y-2 animate-in slide-in-from-top duration-300">
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block">Promo Coupon Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        disabled={!!couponMeta || couponLoading}
                        value={couponMeta ? couponMeta.code : enteredCoupon}
                        onChange={(e) => setEnteredCoupon(e.target.value)}
                        placeholder="E.g., BAKE10, CELEBRATE"
                        className="flex-1 text-xs bg-white border border-brand-pink/25 rounded-xl px-3 py-2 text-brand-chocolate font-bold focus:outline-none focus:ring-1 focus:ring-brand-rosegold focus:border-transparent uppercase placeholder:normal-case disabled:bg-gray-100 disabled:text-gray-400"
                      />
                      {!couponMeta ? (
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading}
                          className="bg-brand-chocolate text-brand-cream hover:opacity-90 font-bold px-4 rounded-xl text-xs flex items-center justify-center cursor-pointer transition"
                        >
                          {couponLoading ? "Checking..." : "Apply"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCouponMeta(null);
                            setEnteredCoupon("");
                            setCouponError("");
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3.5 rounded-xl text-xs cursor-pointer transition"
                          title="Remove promocode"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {couponError && (
                      <p className="text-[11px] text-red-600 font-semibold leading-tight">{couponError}</p>
                    )}

                    {couponMeta && (
                      <p className="text-[11px] text-green-700 font-semibold leading-tight">
                        ✓ Promo code <strong className="uppercase">{couponMeta.code}</strong> applied!
                        {cartSubtotal < couponMeta.minOrderAmount && (
                          <span className="block text-red-600 font-bold mt-1 text-[10px]">
                            * Cart subtotal falls below ${couponMeta.minOrderAmount} minimum order required for this promo code. Buy some more sweets to activate!
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Checkout Info Form */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckout} className="mt-6 space-y-4 pt-4 border-t border-brand-pink/25">
                <h4 className="text-xs font-black text-brand-chocolate uppercase tracking-wider block mb-1">
                  Fulfillment Details
                </h4>

                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block pl-1">Full Name</label>
                  <div className="relative mt-1">
                    <User className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Rebecca Davis"
                      className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl pl-9 py-3 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all placeholder-brand-chocolate/30 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block pl-1">Email</label>
                    <div className="relative mt-1">
                      <Mail className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="rebecca@gmail.com"
                        className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl pl-9 py-3 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all placeholder-brand-chocolate/30 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block pl-1">Phone</label>
                    <div className="relative mt-1">
                      <Phone className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="469-555-1234"
                        className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl pl-9 py-3 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all placeholder-brand-chocolate/30 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {fulfillmentType === "delivery" && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block pl-1">Delivery Address (Royse City Local)</label>
                    <div className="relative mt-1">
                      <MapPin className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required={fulfillmentType === "delivery"}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="104 Elm St, Royse City, TX"
                        className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl pl-9 py-3 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all placeholder-brand-chocolate/30 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block flex items-center justify-between px-1">
                    <span>Fulfillment Date Choice</span>
                    <span className="text-[8px] text-brand-rosegold font-black bg-brand-pink/20 px-2 py-0.5 rounded-full border border-brand-pink/20">Requires {settings?.leadTimeDays || 3} days notice</span>
                  </label>
                  <div className="relative mt-1">
                    <Calendar className="h-3.5 w-3.5 text-brand-chocolate/40 absolute left-3 top-3.5" />
                    <input
                      type="date"
                      required
                      min={getMinFulfillmentDate()}
                      value={fulfillmentDate}
                      onChange={(e) => setFulfillmentDate(e.target.value)}
                      className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl pl-9 py-3 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all font-bold cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block pl-1">Add-on Notes / Custom writing requests</label>
                  <textarea
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="E.g., Allergen alerts, specific lettering colors: 'Happy Birthday Sarah!'"
                    rows={2}
                    className="w-full text-xs bg-brand-cream/25 border-2 border-brand-pink/10 rounded-2xl p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-brand-rosegold/40 focus:border-transparent transition-all placeholder-brand-chocolate/30 font-bold resize-none"
                  />
                </div>

                {/* Status and Submission */}
                {errorMessage && (
                  <div className="p-3.5 bg-red-50 text-red-700 rounded-2xl text-[11px] font-bold flex items-start space-x-2 border border-red-150 animate-bounce">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/95 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer transform-gpu active:scale-98"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-brand-cream"></div>
                      <span>Preparing Secure Checkout...</span>
                    </>
                  ) : (
                    <span>Proceed to Secure Payment — ${cartTotal.toFixed(2)}</span>
                  )}
                </button>
                <p className="text-center text-[10px] text-gray-500 mt-1.5 font-semibold">
                  Secure payment powered by Stripe.
                </p>
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
                <p className="mt-1 text-gray-700 font-medium">
                  Lainie will review your date (<strong className="text-brand-chocolate">{successOrder.fulfillmentDate}</strong>) and special notes, and text or email a confirmation soon with payment guidelines. Thank you!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature 7 - Curated Instagram Feed Section */}
      {settings?.instagramFeedUrls && settings.instagramFeedUrls.length > 0 && (
        <div className="mt-16 pt-12 border-t border-brand-pink/20 space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center space-x-2 bg-brand-chocolate text-brand-cream px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
              <span>★ INSTAGRAM SHOWCASE</span>
            </div>
            <h3 className="font-heading text-2xl lg:text-3xl font-bold text-brand-chocolate">Curated Daily Sweet Inspirations</h3>
            <p className="text-xs text-brand-chocolate/70 max-w-md mx-auto leading-normal">
              Follow us on Instagram <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="text-brand-rosegold hover:underline font-bold">@LainiesSweetTreats</a> to view our freshly baked custom wedding designs and seasonal mini cakes!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {settings.instagramFeedUrls.slice(0, 6).map((url, idx) => (
              <a
                key={idx}
                href="https://www.instagram.com/"
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-brand-pink/15 block hover:-translate-y-1 hover:shadow-md transition-all duration-300 group"
              >
                <img 
                  src={url} 
                  alt="Lainies Sweet Treats Instagram Post" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="text-white text-[10px] font-black uppercase tracking-wider bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/20">
                    Open Post ↗
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      </div>
      </div>

      {/* CUSTOMIZABLE SELECTION MODAL PANELS (IF PRODUCT SELECTED) */}
      {selectedProduct && (() => {
        const hasVariations = selectedProduct.variations && selectedProduct.variations.length > 0;
        const activeVar = selectedProduct.variations?.find(v => v.id === selectedVarId);
        
        const activeSizes = activeVar ? (activeVar.options?.sizes || []) : (selectedProduct.options?.sizes || []);
        
        const rawFlavors = activeVar ? activeVar.options?.flavors : selectedProduct.options?.flavors;
        const resolvedFlavors = resolveToOptions(rawFlavors);

        const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : selectedProduct.options?.cakeFlavors;
        const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);

        const rawFrostings = activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (selectedProduct.options?.frostings || selectedProduct.options?.flavors);
        const resolvedFrostings = resolveToOptions(rawFrostings);

        const rawToppings = activeVar 
          ? (activeVar.options?.toppings || activeVar.options?.addOns) 
          : (selectedProduct.options?.toppings || selectedProduct.options?.addOns);
        const resolvedToppings = resolveToOptions(rawToppings);

        const rawDrizzles = activeVar ? activeVar.options?.drizzles : selectedProduct.options?.drizzles;
        const resolvedDrizzles = resolveToOptions(rawDrizzles);

        const activeDescription = activeVar?.description || selectedProduct.description || "";

        const hasToppingsConfigured = (!hasVariations || selectedVarId) && resolvedToppings && resolvedToppings.length > 0;
        const isToppingRequiredAndMissing = hasToppingsConfigured && (!choiceAddOns || choiceAddOns.length === 0 || !choiceAddOns[0]);
        
        const hasDrizzlesConfigured = (!hasVariations || selectedVarId) && resolvedDrizzles && resolvedDrizzles.length > 0;
        const isDrizzleRequiredAndMissing = hasDrizzlesConfigured && !choiceDrizzle;

        const hasCakeFlavorsConfigured = (!hasVariations || selectedVarId) && resolvedCakeFlavors && resolvedCakeFlavors.length > 0;
        const isCakeFlavorRequiredAndMissing = hasCakeFlavorsConfigured && !choiceCakeFlavor;

        const hasFrostingsConfigured = (!hasVariations || selectedVarId) && resolvedFrostings && resolvedFrostings.length > 0;
        const isFrostingRequiredAndMissing = hasFrostingsConfigured && !choiceFrosting && !choiceFlavor;

        const isAddDisabled = (hasVariations && !selectedVarId) || isToppingRequiredAndMissing || isDrizzleRequiredAndMissing || isCakeFlavorRequiredAndMissing || isFrostingRequiredAndMissing;

        return (
          <div className="fixed inset-0 bg-brand-chocolate/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-brand-pink/30 p-6 shadow-xl relative animate-in fade-in duration-300">
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 text-brand-chocolate/60 hover:text-brand-chocolate text-xl font-bold p-1 animate-hover-pulse"
              >
                ✕
              </button>
              
              <h3 className="text-lg font-bold text-brand-chocolate font-heading italic">
                Configure Your Treats
              </h3>
              <p className="text-[11px] text-brand-rosegold font-bold uppercase tracking-wider mt-0.5">
                {selectedProduct.name} {activeVar ? `(${activeVar.name})` : ""}
              </p>

              {activeDescription && (
                <p className="font-sans text-[12px] font-normal text-[#8D6E63] leading-normal mt-1 select-none">
                  {activeDescription}
                </p>
              )}

              {/* Visual Carousel/Gallery of All Photos */}
              <div className="mt-3">
                <ProductPhotoGallery product={selectedProduct} selectedVariationId={selectedVarId} />
              </div>

              {/* CUSTOMER-FACING MINI CAKE TYPE VARIATIONS SWITCHER */}
              {hasVariations && (
                <div className="mt-5 p-3.5 bg-brand-cream/25 border border-brand-pink/15 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">
                    Choose Mini Cake Type:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.variations?.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVarId(v.id);
                          const newSizes = v.options.sizes || [];
                          if (choiceSize && !newSizes.some(sz => sz.name === choiceSize)) {
                            setChoiceSize("");
                          }
                          const newFlavors = resolveToOptions(v.options.flavors).map(f => f.name);
                          if (choiceFlavor && !newFlavors.includes(choiceFlavor)) {
                            setChoiceFlavor("");
                          }
                          if (!choiceFlavor && newFlavors.length > 0) {
                            setChoiceFlavor(newFlavors[0]);
                          }
                          const newCakeFlavors = resolveToOptions(v.options.cakeFlavors).map(cf => cf.name);
                          if (choiceCakeFlavor && !newCakeFlavors.includes(choiceCakeFlavor)) {
                            setChoiceCakeFlavor("");
                          }
                          if (!choiceCakeFlavor && newCakeFlavors.length > 0) {
                            setChoiceCakeFlavor(newCakeFlavors[0]);
                          }
                          const newFrostings = resolveToOptions(v.options.frostings || v.options.flavors).map(f => f.name);
                          if (choiceFrosting && !newFrostings.includes(choiceFrosting)) {
                            setChoiceFrosting("");
                          }
                          if (!choiceFrosting && newFrostings.length > 0) {
                            setChoiceFrosting(newFrostings[0]);
                          }
                          const newToppings = resolveToOptions(v.options.toppings || v.options.addOns).map(t => t.name);
                          setChoiceAddOns(choiceAddOns.filter(addName => newToppings.includes(addName)));
                          const newDrizzles = resolveToOptions(v.options.drizzles).map(d => d.name);
                          if (choiceDrizzle && !newDrizzles.includes(choiceDrizzle)) {
                            setChoiceDrizzle("");
                          }
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 text-center flex flex-col justify-center items-center ${
                          selectedVarId === v.id
                            ? "bg-brand-chocolate text-brand-cream border-2 border-brand-chocolate shadow-sm scale-[1.02]"
                            : "bg-white text-brand-chocolate border border-brand-pink/15 hover:bg-brand-pink/5"
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className="text-[9px] opacity-75 font-medium mt-0.5">
                          Starting at ${v.basePrice.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!selectedVarId && (
                    <p className="text-[10px] text-red-500 font-semibold italic text-center animate-pulse">
                      * Please select Normal or Specialty to see available options & pricing.
                    </p>
                  )}
                </div>
              )}

              {/* Sizes Radio selections */}
              {(!hasVariations || selectedVarId) && activeSizes && activeSizes.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                    1. Highlight Size / Serving Count:
                  </label>
                  <div className="space-y-2">
                     {activeSizes.map(sz => (
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

              {/* Available Cake Flavors selections */}
              {(!hasVariations || selectedVarId) && resolvedCakeFlavors && resolvedCakeFlavors.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                    2. Selected Cake Flavor:
                  </label>
                  <select
                    value={choiceCakeFlavor}
                    onChange={(e) => setChoiceCakeFlavor(e.target.value)}
                    className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  >
                    <option value="" disabled>-- Select Cake Flavor --</option>
                    {resolvedCakeFlavors.map(cf => (
                      <option key={cf.name} value={cf.name}>
                        {cf.name} {cf.priceAdd > 0 ? `(+$${cf.priceAdd.toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Available Frostings selections */}
              {(!hasVariations || selectedVarId) && resolvedFrostings && resolvedFrostings.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                    3. Selected Frosting Preference:
                  </label>
                  <select
                    value={choiceFrosting || choiceFlavor}
                    onChange={(e) => {
                      setChoiceFrosting(e.target.value);
                      setChoiceFlavor(e.target.value);
                    }}
                    className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  >
                    <option value="" disabled>-- Select Frosting --</option>
                    {resolvedFrostings.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.name} {f.priceAdd > 0 ? `(+$${f.priceAdd.toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected Drizzle selections */}
              {(!hasVariations || selectedVarId) && resolvedDrizzles && resolvedDrizzles.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                    SELECTED DRIZZLE:
                  </label>
                  <select
                    value={choiceDrizzle}
                    onChange={(e) => setChoiceDrizzle(e.target.value)}
                    className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  >
                    <option value="" disabled>-- Select a drizzle --</option>
                    {resolvedDrizzles.map(d => (
                      <option key={d.name} value={d.name}>
                        {d.name} {d.priceAdd > 0 ? `(+$${d.priceAdd.toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toppings List dropdown selector */}
              {(!hasVariations || selectedVarId) && resolvedToppings && resolvedToppings.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                    Selected Topping:
                  </label>
                  <select
                    value={choiceAddOns[0] || ""}
                    onChange={(e) => setChoiceAddOns(e.target.value ? [e.target.value] : [])}
                    className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                  >
                    <option value="" disabled>-- Select Topping --</option>
                    {resolvedToppings.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name} {t.priceAdd > 0 ? `(+$${t.priceAdd.toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity and Checkout action */}
              <div className="mt-6 pt-4 border-t border-brand-pink/10 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => setChoiceQty(Math.max(1, choiceQty - 1))}
                    className="bg-brand-cream hover:bg-brand-pink px-2.5 py-1 rounded-md text-sm font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{choiceQty}</span>
                  <button 
                    type="button"
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
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-brand-chocolate py-2.5 rounded-full text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAddDisabled}
                  onClick={handleAddToBag}
                  className={`flex-1 py-2.5 rounded-full text-xs font-semibold transition ${
                    isAddDisabled
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-brand-rosegold hover:bg-brand-rosegold/90 text-white shadow-xs"
                  }`}
                >
                  Add to Baking Bag
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
