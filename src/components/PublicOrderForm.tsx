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
  const [choiceDrizzle, setChoiceDrizzle] = useState<string[]>([]);
  const [choiceAddOns, setChoiceAddOns] = useState<string[]>([]);
  const [choiceSprinkles, setChoiceSprinkles] = useState<string[]>([]);
  const [choiceQty, setChoiceQty] = useState<number>(1);

  // Reset variation and selections on product change
  useEffect(() => {
    if (selectedProduct) {
      setSelectedVarId(null);
      setChoiceSize("");
      setChoiceFlavor("");
      setChoiceCakeFlavor("");
      setChoiceFrosting("");
      setChoiceDrizzle([]);
      setChoiceAddOns([]);
      setChoiceSprinkles([]);
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
        if (stored === "Cookies") {
          setActiveCategory("All");
          sessionStorage.setItem("lainie_shop_category", "All");
        } else {
          setActiveCategory(stored);
        }
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
    const isDippedPretzels = p.category === "Dipped Pretzels" || p.name === "Dipped Pretzels";
    const activeFrostings = isDippedPretzels ? [] : (p.options.frostings || p.options.flavors);
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

  const getPriceSuffix = (priceAdd: number) => {
    if (priceAdd <= 0) return "";
    const isMiniCakes = selectedProduct && (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes");
    const isCupcakes = selectedProduct && (selectedProduct.category === "Cupcakes" || selectedProduct.name === "Cupcakes");
    const isDippedPretzels = selectedProduct && (selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels");
    if (isMiniCakes || isCupcakes || isDippedPretzels) {
      return ` (+$${priceAdd.toFixed(2)} per dozen)`;
    }
    return ` (+$${priceAdd.toFixed(2)})`;
  };

  const getPriceLabel = (priceAdd: number) => {
    if (priceAdd <= 0) return "Included";
    const isMiniCakes = selectedProduct && (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes");
    const isCupcakes = selectedProduct && (selectedProduct.category === "Cupcakes" || selectedProduct.name === "Cupcakes");
    const isDippedPretzels = selectedProduct && (selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels");
    if (isMiniCakes || isCupcakes || isDippedPretzels) {
      return `+$${priceAdd.toFixed(2)}/dozen`;
    }
    return `+$${priceAdd.toFixed(2)}`;
  };

  const getMiniCakesBreakdown = (item: OrderItem) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return null;
    const isMiniCakes = product.category === "Mini Cakes" || product.name === "Mini Cakes";
    if (!isMiniCakes) return null;

    const activeVar = product.variations?.find(v => v.id === item.variationId);
    const activeSizes = activeVar ? (activeVar.options.sizes || []) : (product.options.sizes || []);
    
    let selectedFullPrice: number | null = null;
    let sizePriceModifier = 0;
    let dozenCount = 1;

    if (item.size && activeSizes.length > 0) {
      const sizeObj = activeSizes.find(s => s.name === item.size);
      if (sizeObj) {
        const isAdditive = sizeObj.name.includes('+') || activeSizes.some(s => Number(s.priceAdd || 0) === 0);
        if (isAdditive) {
          sizePriceModifier = sizeObj.priceAdd || 0;
        } else {
          selectedFullPrice = sizeObj.priceAdd || 0;
        }
        
        if (typeof (sizeObj as any).dozenCount === "number" && (sizeObj as any).dozenCount > 0) {
          dozenCount = (sizeObj as any).dozenCount;
        } else {
          const nameLower = sizeObj.name.toLowerCase().trim();
          if (nameLower === "dozen" || nameLower === "one dozen") dozenCount = 1;
          else if (nameLower === "two dozen") dozenCount = 2;
          else if (nameLower === "three dozen") dozenCount = 3;
          else if (nameLower === "four dozen") dozenCount = 4;
          else if (nameLower === "five dozen") dozenCount = 5;
        }
      }
    }

    if (selectedFullPrice === null) {
      selectedFullPrice = activeVar ? activeVar.basePrice : product.basePrice;
    }

    const basePrice = selectedFullPrice + sizePriceModifier;
    const breakdownItems: Array<{ name: string; unitPrice: number; totalPrice: number }> = [];

    // Cake flavors
    const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : product.options?.cakeFlavors;
    const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);
    if (item.selectedCakeFlavors && resolvedCakeFlavors) {
      item.selectedCakeFlavors.forEach(cfName => {
        const cfObj = resolvedCakeFlavors.find(cf => cf.name === cfName);
        if (cfObj && cfObj.priceAdd > 0) {
          breakdownItems.push({
            name: cfName,
            unitPrice: cfObj.priceAdd,
            totalPrice: cfObj.priceAdd * dozenCount
          });
        }
      });
    }

    // Frostings
    const isDippedPretzels = product.category === "Dipped Pretzels" || product.name === "Dipped Pretzels";
    const rawFrostings = isDippedPretzels ? [] : (activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (product.options?.frostings || product.options?.flavors));
    const resolvedFrostings = resolveToOptions(rawFrostings);
    const selectedFrostings = item.selectedFrostings || (item.flavor ? [item.flavor] : []);
    if (selectedFrostings && resolvedFrostings) {
      selectedFrostings.forEach(fName => {
        const fObj = resolvedFrostings.find(f => f.name === fName);
        if (fObj && fObj.priceAdd > 0) {
          breakdownItems.push({
            name: fName,
            unitPrice: fObj.priceAdd,
            totalPrice: fObj.priceAdd * dozenCount
          });
        }
      });
    }

    // Drizzles
    const rawDrizzles = activeVar ? activeVar.options?.drizzles : product.options?.drizzles;
    const resolvedDrizzles = resolveToOptions(rawDrizzles);
    const selectedDrizzles = item.selectedDrizzles || (item.selectedDrizzle ? [item.selectedDrizzle] : []);
    if (selectedDrizzles && resolvedDrizzles) {
      selectedDrizzles.forEach(dName => {
        const dObj = resolvedDrizzles.find(d => d.name === dName);
        if (dObj && dObj.priceAdd > 0) {
          breakdownItems.push({
            name: dName,
            unitPrice: dObj.priceAdd,
            totalPrice: dObj.priceAdd * dozenCount
          });
        }
      });
    }

    // Toppings or Sprinkles
    const isNormalMiniCakes = item.variationId === "normal";
    if (isNormalMiniCakes) {
      const rawSprinkles = activeVar?.options?.sprinkles !== undefined ? activeVar.options.sprinkles : (activeVar?.options?.toppings || activeVar?.options?.addOns);
      const resolvedSprinkles = resolveToOptions(rawSprinkles);
      const selectedSprinkles = item.selectedSprinkles || item.addOns || [];
      if (selectedSprinkles && resolvedSprinkles) {
        selectedSprinkles.forEach(sName => {
          const sObj = resolvedSprinkles.find(s => s.name === sName);
          if (sObj && sObj.priceAdd > 0) {
            breakdownItems.push({
              name: sName,
              unitPrice: sObj.priceAdd,
              totalPrice: sObj.priceAdd * dozenCount
            });
          }
        });
      }
    } else {
      const rawToppings = activeVar ? (activeVar.options?.toppings || activeVar.options?.addOns) : (product.options?.toppings || product.options?.addOns);
      const resolvedToppings = resolveToOptions(rawToppings);
      const selectedToppings = item.selectedToppings || item.addOns || [];
      if (selectedToppings && resolvedToppings) {
        selectedToppings.forEach(tName => {
          const tObj = resolvedToppings.find(t => t.name === tName);
          if (tObj && tObj.priceAdd > 0) {
            breakdownItems.push({
              name: tName,
              unitPrice: tObj.priceAdd,
              totalPrice: tObj.priceAdd * dozenCount
            });
          }
        });
      }
    }

    return {
      basePrice,
      dozenCount,
      breakdownItems
    };
  };

  // Live item total calculation
  const getSelectedProductPrice = () => {
    if (!selectedProduct) return 0;
    
    const activeVar = selectedProduct.variations?.find(v => v.id === selectedVarId);
    const activeSizes = activeVar ? (activeVar.options.sizes || []) : (selectedProduct.options.sizes || []);
    
    let price = 0;
    let selectedFullPrice: number | null = null;
    let sizePriceModifier = 0;

    if (choiceSize && activeSizes.length > 0) {
      const sizeObj = activeSizes.find(s => s.name === choiceSize);
      if (sizeObj) {
        const isAdditive = sizeObj.name.includes('+') || activeSizes.some(s => Number(s.priceAdd || 0) === 0);
        if (isAdditive) {
          sizePriceModifier = sizeObj.priceAdd || 0;
        } else {
          selectedFullPrice = sizeObj.priceAdd || 0;
        }
      }
    }

    if (selectedFullPrice === null) {
      selectedFullPrice = activeVar ? activeVar.basePrice : selectedProduct.basePrice;
    }

    price = selectedFullPrice + sizePriceModifier;

    const isMiniCakes = selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes";
    const isCupcakes = selectedProduct.category === "Cupcakes" || selectedProduct.name === "Cupcakes";
    let dozenCount = 1;
    let addonPrice = 0;

    if (choiceSize && activeSizes.length > 0) {
      const sizeObj = activeSizes.find(s => s.name === choiceSize);
      if (sizeObj) {
        if (typeof (sizeObj as any).dozenCount === "number" && (sizeObj as any).dozenCount > 0) {
          dozenCount = (sizeObj as any).dozenCount;
        } else {
          const nameLower = sizeObj.name.toLowerCase().trim();
          if (nameLower === "dozen" || nameLower === "one dozen") dozenCount = 1;
          else if (nameLower === "two dozen") dozenCount = 2;
          else if (nameLower === "three dozen") dozenCount = 3;
          else if (nameLower === "four dozen") dozenCount = 4;
          else if (nameLower === "five dozen") dozenCount = 5;
        }
      }
    }

    // Cake Flavor price addition
    const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : selectedProduct.options?.cakeFlavors;
    const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);
    if (choiceCakeFlavor && resolvedCakeFlavors) {
      const cakeFlavorObj = resolvedCakeFlavors.find(cf => cf.name === choiceCakeFlavor);
      if (cakeFlavorObj) {
        let priceAdd = cakeFlavorObj.priceAdd;
        if (isCupcakes && cakeFlavorObj.name.toLowerCase().includes("marble") && priceAdd === 0) {
          priceAdd = 5.0;
        }
        if (isMiniCakes) {
          addonPrice += priceAdd;
        } else if (isCupcakes) {
          price += priceAdd * dozenCount;
        } else {
          price += priceAdd;
        }
      }
    }

    // Frosting price addition
    const isDippedPretzels = selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels";
    const rawFrostings = isDippedPretzels ? [] : (activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (selectedProduct.options?.frostings || selectedProduct.options?.flavors));
    const resolvedFrostings = resolveToOptions(rawFrostings);
    const selectedFrostingVal = choiceFrosting || choiceFlavor;
    if (selectedFrostingVal && resolvedFrostings) {
      const frostingObj = resolvedFrostings.find(f => f.name === selectedFrostingVal);
      if (frostingObj) {
        if (isMiniCakes) {
          addonPrice += frostingObj.priceAdd;
        } else if (isCupcakes) {
          price += frostingObj.priceAdd * dozenCount;
        } else {
          price += frostingObj.priceAdd;
        }
      }
    }

    // Drizzle price addition
    const rawDrizzles = activeVar ? activeVar.options?.drizzles : selectedProduct.options?.drizzles;
    const resolvedDrizzles = resolveToOptions(rawDrizzles);
    if (choiceDrizzle && choiceDrizzle.length > 0 && resolvedDrizzles) {
      choiceDrizzle.forEach(dName => {
        const drizzleObj = resolvedDrizzles.find(d => d.name === dName);
        if (drizzleObj) {
          if (isMiniCakes) addonPrice += drizzleObj.priceAdd;
          else price += drizzleObj.priceAdd;
        }
      });
    }

    // Topping or Sprinkle price addition
    const isNormalMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && selectedVarId === "normal";
    if (isNormalMiniCakes) {
      const rawSprinkles = activeVar?.options?.sprinkles !== undefined ? activeVar.options.sprinkles : (activeVar?.options?.toppings || activeVar?.options?.addOns);
      const resolvedSprinkles = resolveToOptions(rawSprinkles);
      if (choiceSprinkles && choiceSprinkles.length > 0 && resolvedSprinkles) {
        choiceSprinkles.forEach(sName => {
          const sprinkleObj = resolvedSprinkles.find(s => s.name === sName);
          if (sprinkleObj) {
            if (isMiniCakes) addonPrice += sprinkleObj.priceAdd;
            else price += sprinkleObj.priceAdd;
          }
        });
      }
    } else {
      const rawToppings = activeVar 
        ? (activeVar.options?.toppings || activeVar.options?.addOns) 
        : (selectedProduct.options?.toppings || selectedProduct.options?.addOns);
      const resolvedToppings = resolveToOptions(rawToppings);
      if (choiceAddOns && choiceAddOns.length > 0 && resolvedToppings) {
        choiceAddOns.forEach(tName => {
          const toppingObj = resolvedToppings.find(t => t.name === tName);
          if (toppingObj) {
            if (isMiniCakes) addonPrice += toppingObj.priceAdd;
            else if (isCupcakes) price += toppingObj.priceAdd * dozenCount;
            else price += toppingObj.priceAdd;
          }
        });
      }
    }

    if (isMiniCakes) {
      const baseCents = Math.round(price * 100);
      const addonCents = Math.round(addonPrice * 100);
      price = (baseCents + addonCents * dozenCount) / 100;
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

    const isNormalMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && selectedVarId === "normal";
    const isCupcakes = selectedProduct.category === "Cupcakes" || selectedProduct.name === "Cupcakes";

    let dozenCount = 1;
    if (choiceSize && activeSizes) {
      const sizeObj = activeSizes.find(s => s.name === choiceSize);
      if (sizeObj) {
        if (typeof (sizeObj as any).dozenCount === "number" && (sizeObj as any).dozenCount > 0) {
          dozenCount = (sizeObj as any).dozenCount;
        } else {
          const nameLower = sizeObj.name.toLowerCase().trim();
          if (nameLower === "dozen" || nameLower === "one dozen") dozenCount = 1;
          else if (nameLower === "two dozen") dozenCount = 2;
          else if (nameLower === "three dozen") dozenCount = 3;
          else if (nameLower === "four dozen") dozenCount = 4;
          else if (nameLower === "five dozen") dozenCount = 5;
        }
      }
    }

    const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : selectedProduct.options?.cakeFlavors;
    const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);
    let flavorName: string | undefined;
    let flavorPricePerDozen: number | undefined;
    let selectedDozenQuantity: number | undefined;
    let flavorUpchargeTotal: number | undefined;

    if (isCupcakes && choiceCakeFlavor && resolvedCakeFlavors) {
      const cfObj = resolvedCakeFlavors.find(cf => cf.name === choiceCakeFlavor);
      if (cfObj) {
        let priceAdd = cfObj.priceAdd;
        if (cfObj.name.toLowerCase().includes("marble") && priceAdd === 0) {
          priceAdd = 5.0;
        }
        if (priceAdd > 0) {
          flavorName = cfObj.name;
          flavorPricePerDozen = priceAdd;
          selectedDozenQuantity = dozenCount;
          flavorUpchargeTotal = priceAdd * dozenCount;
        }
      }
    }

    const isDippedPretzels = selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels";
    const rawFrostings = isDippedPretzels ? [] : (activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (selectedProduct.options?.frostings || selectedProduct.options?.flavors));
    const resolvedFrostings = resolveToOptions(rawFrostings);
    let selectedFrostingName: string | undefined;
    let frostingName: string | undefined;
    let frostingPricePerDozen: number | undefined;
    let frostingUpchargeTotal: number | undefined;

    const selectedFrostingVal = choiceFrosting || choiceFlavor;
    if (isCupcakes && selectedFrostingVal && resolvedFrostings) {
      const fObj = resolvedFrostings.find(f => f.name === selectedFrostingVal);
      if (fObj && fObj.priceAdd > 0) {
        selectedFrostingName = fObj.name;
        frostingName = fObj.name;
        frostingPricePerDozen = fObj.priceAdd;
        selectedDozenQuantity = dozenCount;
        frostingUpchargeTotal = fObj.priceAdd * dozenCount;
      }
    }

    let toppingPricePerDozen: number | undefined;
    let toppingUpchargeTotal: number | undefined;
    let totalToppingUpcharge: number | undefined;
    let drizzlePricePerDozen: number | undefined;
    let drizzleUpchargeTotal: number | undefined;
    let totalDrizzleUpcharge: number | undefined;

    if (isDippedPretzels || isCupcakes) {
      selectedDozenQuantity = dozenCount;

      const rawToppings = activeVar 
        ? (activeVar.options?.toppings || activeVar.options?.addOns) 
        : (selectedProduct.options?.toppings || selectedProduct.options?.addOns);
      const resolvedToppings = resolveToOptions(rawToppings);
      if (choiceAddOns.length > 0 && resolvedToppings.length > 0) {
        let tSum = 0;
        choiceAddOns.forEach(tName => {
          const tObj = resolvedToppings.find(t => t.name === tName);
          if (tObj && tObj.priceAdd > 0) {
            tSum += tObj.priceAdd;
          }
        });
        if (tSum > 0) {
          toppingPricePerDozen = tSum;
          toppingUpchargeTotal = tSum * dozenCount;
          totalToppingUpcharge = tSum * dozenCount;
        }
      }

      const rawDrizzles = activeVar ? activeVar.options?.drizzles : selectedProduct.options?.drizzles;
      const resolvedDrizzles = resolveToOptions(rawDrizzles);
      if (choiceDrizzle.length > 0 && resolvedDrizzles.length > 0) {
        let dSum = 0;
        choiceDrizzle.forEach(dName => {
          const dObj = resolvedDrizzles.find(d => d.name === dName);
          if (dObj && dObj.priceAdd > 0) {
            dSum += dObj.priceAdd;
          }
        });
        if (dSum > 0) {
          drizzlePricePerDozen = dSum;
          drizzleUpchargeTotal = dSum * dozenCount;
          totalDrizzleUpcharge = dSum * dozenCount;
        }
      }
    }

    const cartItem: OrderItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: choiceQty,
      size: choiceSize || undefined,
      flavor: choiceFrosting || choiceFlavor || undefined,
      selectedCakeFlavors: choiceCakeFlavor ? [choiceCakeFlavor] : undefined,
      selectedFrostings: choiceFrosting ? [choiceFrosting] : undefined,
      addOns: !isNormalMiniCakes && choiceAddOns.length > 0 ? choiceAddOns : undefined,
      selectedToppings: !isNormalMiniCakes && choiceAddOns.length > 0 ? choiceAddOns : undefined,
      selectedSprinkles: isNormalMiniCakes && choiceSprinkles.length > 0 ? choiceSprinkles : undefined,
      selectedDrizzle: choiceDrizzle[0] || undefined,
      selectedDrizzles: choiceDrizzle.length > 0 ? choiceDrizzle : undefined,
      unitPrice,
      totalPrice: itemTotal,
      variationId: activeVar?.id,
      variationName: activeVar?.name,
      variationBasePrice: activeVar?.basePrice,
      sizePriceAdd: sizePriceAdd,
      flavorName,
      flavorPricePerDozen,
      selectedDozenQuantity,
      flavorUpchargeTotal,
      selectedFrostingName,
      frostingName,
      frostingPricePerDozen,
      frostingUpchargeTotal,
      toppingPricePerDozen,
      toppingUpchargeTotal,
      totalToppingUpcharge,
      drizzlePricePerDozen,
      drizzleUpchargeTotal,
      totalDrizzleUpcharge
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

  // Calculate taxable subtotal (ONLY Mini Cakes or items explicitly marked taxable)
  const cartTaxableSubtotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    let isTaxable = false;
    if (product) {
      if (typeof product.isTaxable === "boolean") {
        isTaxable = product.isTaxable;
      } else if (typeof (product as any).taxable === "boolean") {
        isTaxable = (product as any).taxable;
      } else {
        const cat = (product.category || "").toLowerCase().trim();
        const pName = (product.name || "").toLowerCase().trim();
        isTaxable = cat === "mini cakes" || pName === "mini cakes" || pName.includes("mini cake");
      }
    } else {
      const iName = (item.name || "").toLowerCase().trim();
      const iCat = ((item as any).category || "").toLowerCase().trim();
      isTaxable = iCat === "mini cakes" || iName === "mini cakes" || iName.includes("mini cake");
    }
    return isTaxable ? sum + item.totalPrice : sum;
  }, 0);

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
  const discountRatio = cartSubtotal > 0 ? (calculatedDiscount / cartSubtotal) : 0;
  const discountedTaxableSubtotal = Math.max(0, cartTaxableSubtotal * (1 - discountRatio));

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

  const cartTax = parseFloat((discountedTaxableSubtotal * taxRate).toFixed(2));
  const deliveryFlatFee = typeof settings?.deliveryFee === "number" ? settings.deliveryFee : 10.00;
  const deliveryCost = fulfillmentType === "delivery" ? deliveryFlatFee : 0;
  const safeDiscountedSubtotal = isNaN(discountedSubtotal) ? 0 : discountedSubtotal;
  const safeTipAmount = isNaN(cartTipAmount) ? 0 : cartTipAmount;
  const safeTax = isNaN(cartTax) ? 0 : cartTax;
  const safeDeliveryCost = isNaN(deliveryCost) ? 0 : deliveryCost;
  const cartTotal = parseFloat((safeDiscountedSubtotal + safeTipAmount + safeTax + safeDeliveryCost).toFixed(2));

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
        selectedDrizzles: (item.selectedDrizzles && item.selectedDrizzles.length > 0) ? item.selectedDrizzles : (item.selectedDrizzle ? [item.selectedDrizzle] : undefined),
        selectedToppings: (item.selectedToppings && item.selectedToppings.length > 0) ? item.selectedToppings : (item.addOns || undefined),
        selectedSprinkles: item.selectedSprinkles || undefined
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
        // Must navigate the top-level browsing context, not just this frame — Stripe Checkout
        // refuses to render inside an iframe (e.g. when this app is embedded in GoHighLevel).
        try {
          window.top!.location.assign(data.checkoutUrl);
        } catch (e) {
          // Cross-origin/sandboxed iframe blocked top-level navigation — fall back to opening
          // Checkout in a new tab so the flow still works.
          window.open(data.checkoutUrl, "_blank");
        }
      } else {
        setErrorMessage(data.error || "Something went wrong. Please check your order criteria.");
      }
    } catch (err) {
      setErrorMessage("Network error connecting to Stripe. Please try again!");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["All", "Mini Cakes", "Cupcakes", "Dipped Pretzels"];
  const filteredProducts = products.filter(p => {
    const pCatLower = (p.category || "").toLowerCase().trim();
    const pNameLower = (p.name || "").toLowerCase().trim();
    if (pCatLower === "cookies" || pNameLower.includes("jumbo cookies") || pNameLower.includes("cookies that people like")) {
      return false;
    }
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
              className="text-3xl md:text-[38px] lg:text-[42px] text-black font-bold font-heading leading-tight mb-4"
              style={{ textShadow: "0 2px 12px rgba(255,255,255,0.4)", letterSpacing: "0.8px" }}
            >
              Baked with Love by Lainie
            </h2>
            
            <p 
              className="text-sm md:text-base text-black leading-relaxed font-normal mb-2 font-heading"
              style={{ textShadow: "0 2px 12px rgba(255,255,255,0.4)" }}
            >
              Based in Royse City, TX. Lainie specializes in beautifully crafted mini cakes made fresh for birthdays, showers, weddings, and life's sweetest celebrations.
            </p>
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
                          {item.category === "Dipped Pretzels" || item.name?.includes("Dipped Pretzels") ? "Dip Flavor: " : "Cake Flavor: "}{item.selectedCakeFlavors.join(", ")}
                        </p>
                      )}
                      {((item.flavorUpchargeTotal && item.flavorUpchargeTotal > 0) || (item.selectedCakeFlavors && item.selectedCakeFlavors.some(f => f.toLowerCase().includes("marble")) && (item.name?.toLowerCase().includes("cupcake") || item.category?.toLowerCase().includes("cupcake")))) && (
                        <p className="text-[10px] text-brand-rosegold font-bold mt-0.5">
                          {item.flavorName || "Marble"} Flavor Upgrade: +${(item.flavorPricePerDozen || 5.0).toFixed(2)} per dozen × {item.selectedDozenQuantity || 1} dozen = +${(item.flavorUpchargeTotal || 5.0).toFixed(2)}
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
                      {item.frostingUpchargeTotal && item.frostingUpchargeTotal > 0 ? (
                        <p className="text-[10px] text-brand-rosegold font-bold mt-0.5">
                          {item.selectedFrostingName || item.frostingName || item.selectedFrostings?.[0] || item.flavor} Frosting Upgrade: +${(item.frostingPricePerDozen || 0).toFixed(2)} per dozen × {item.selectedDozenQuantity || 1} dozen = +${item.frostingUpchargeTotal.toFixed(2)}
                        </p>
                      ) : null}
                      {((item.selectedDrizzles && item.selectedDrizzles.length > 0) || item.selectedDrizzle) && (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold">
                          Drizzle: {item.selectedDrizzles && item.selectedDrizzles.length > 0 ? item.selectedDrizzles.join(", ") : item.selectedDrizzle}
                        </p>
                      )}
                      {((item.drizzleUpchargeTotal && item.drizzleUpchargeTotal > 0) || (item.totalDrizzleUpcharge && item.totalDrizzleUpcharge > 0)) && (
                        <p className="text-[10px] text-brand-rosegold font-bold mt-0.5">
                          Drizzle Upgrade: +${(item.drizzlePricePerDozen || 0).toFixed(2)} per dozen × {item.selectedDozenQuantity || 1} dozen = +${(item.drizzleUpchargeTotal || item.totalDrizzleUpcharge || 0).toFixed(2)}
                        </p>
                      )}
                      {((item.selectedToppings && item.selectedToppings.length > 0) || (item.addOns && item.addOns.length > 0)) && (
                        <p className="text-[10px] text-brand-chocolate/70 font-semibold mt-0.5">
                          Toppings: {(item.selectedToppings && item.selectedToppings.length > 0 ? item.selectedToppings : item.addOns)!.join(", ")}
                        </p>
                      )}
                      {((item.toppingUpchargeTotal && item.toppingUpchargeTotal > 0) || (item.totalToppingUpcharge && item.totalToppingUpcharge > 0)) && (
                        <p className="text-[10px] text-brand-rosegold font-bold mt-0.5">
                          Topping Upgrade: +${(item.toppingPricePerDozen || 0).toFixed(2)} per dozen × {item.selectedDozenQuantity || 1} dozen = +${(item.toppingUpchargeTotal || item.totalToppingUpcharge || 0).toFixed(2)}
                        </p>
                      )}
                      {item.selectedSprinkles && item.selectedSprinkles.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          <p className="text-[10px] text-brand-chocolate/70 font-semibold">Sprinkles:</p>
                          <div className="flex flex-wrap gap-1">
                            {item.selectedSprinkles.map((sp, i) => (
                              <span key={i} className="text-[9px] bg-brand-pink/15 text-brand-rosegold font-black px-2 py-0.5 rounded border border-brand-pink/20">
                                {sp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const bd = getMiniCakesBreakdown(item);
                        if (!bd) return null;
                        return (
                          <div className="mt-2 p-2 bg-brand-pink/5 rounded-lg border border-brand-pink/10 space-y-1 text-[10px] text-brand-chocolate/75 font-semibold">
                            <div className="flex justify-between">
                              <span>Base Price ({item.size}):</span>
                              <span>${bd.basePrice.toFixed(2)}</span>
                            </div>
                            {bd.breakdownItems.map((bi, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="capitalize">{bi.name}:</span>
                                <span className="text-right">
                                  ${bi.unitPrice.toFixed(2)} × {bd.dozenCount} doz = ${bi.totalPrice.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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
                    <span>Local Delivery:</span>
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

        const isDippedPretzels = selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels";
        const rawFrostings = isDippedPretzels ? [] : (activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (selectedProduct.options?.frostings || selectedProduct.options?.flavors));
        const resolvedFrostings = resolveToOptions(rawFrostings);

        const rawToppings = activeVar 
          ? (activeVar.options?.toppings || activeVar.options?.addOns) 
          : (selectedProduct.options?.toppings || selectedProduct.options?.addOns);
        const resolvedToppings = resolveToOptions(rawToppings);

        const rawDrizzles = activeVar ? activeVar.options?.drizzles : selectedProduct.options?.drizzles;
        const resolvedDrizzles = resolveToOptions(rawDrizzles);

        const rawSprinkles = activeVar?.options?.sprinkles !== undefined 
          ? activeVar.options.sprinkles 
          : (activeVar?.options?.toppings || activeVar?.options?.addOns);
        const resolvedSprinkles = resolveToOptions(rawSprinkles);

        const activeDescription = activeVar?.description || selectedProduct.description || "";

        const isNormalMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && selectedVarId === "normal";

        const cakeFlavorLimit = activeVar?.cakeFlavorSelectionLimit ?? selectedProduct.cakeFlavorSelectionLimit ?? (resolvedCakeFlavors && resolvedCakeFlavors.length > 0 ? 1 : 0);
        const frostingLimit = activeVar?.frostingSelectionLimit ?? activeVar?.flavorSelectionLimit ?? selectedProduct.frostingSelectionLimit ?? selectedProduct.flavorSelectionLimit ?? (resolvedFrostings && resolvedFrostings.length > 0 ? 1 : 0);
        const drizzleLimit = activeVar?.drizzleSelectionLimit ?? selectedProduct.drizzleSelectionLimit ?? 1;
        const toppingLimit = activeVar?.toppingSelectionLimit ?? selectedProduct.toppingSelectionLimit ?? 1;
        const sprinkleLimit = activeVar?.sprinkleSelectionLimit !== undefined 
          ? activeVar.sprinkleSelectionLimit 
          : (activeVar?.toppingSelectionLimit ?? selectedProduct.sprinkleSelectionLimit ?? selectedProduct.toppingSelectionLimit ?? 1);

        const isVariationMissing = hasVariations && !selectedVarId;
        const isSizeMissing = (!hasVariations || selectedVarId) && activeSizes && activeSizes.length > 0 && !choiceSize;
        const isCakeFlavorMissing = (!hasVariations || selectedVarId) && resolvedCakeFlavors && resolvedCakeFlavors.length > 0 && cakeFlavorLimit > 0 && !choiceCakeFlavor;
        const isFrostingMissing = (!hasVariations || selectedVarId) && resolvedFrostings && resolvedFrostings.length > 0 && frostingLimit > 0 && !choiceFrosting && !choiceFlavor;

        const isDrizzleExceeded = choiceDrizzle && choiceDrizzle.length > drizzleLimit;
        const isSprinkleExceeded = isNormalMiniCakes && choiceSprinkles && choiceSprinkles.length > sprinkleLimit;
        const isToppingExceeded = !isNormalMiniCakes && choiceAddOns && choiceAddOns.length > toppingLimit;

        const isAddDisabled = isVariationMissing || isSizeMissing || isCakeFlavorMissing || isFrostingMissing || isDrizzleExceeded || isSprinkleExceeded || isToppingExceeded;

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
                          const isNormalMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && v.id === "normal";
                          if (isNormalMiniCakes) {
                            const rawSprinkles = v.options.sprinkles !== undefined ? v.options.sprinkles : (v.options.toppings || v.options.addOns);
                            const newSprinkles = resolveToOptions(rawSprinkles).map(s => s.name);
                            setChoiceSprinkles(choiceSprinkles.filter(sName => newSprinkles.includes(sName)));
                            setChoiceAddOns([]);
                          } else {
                            const newToppings = resolveToOptions(v.options.toppings || v.options.addOns).map(t => t.name);
                            setChoiceAddOns(choiceAddOns.filter(addName => newToppings.includes(addName)));
                            setChoiceSprinkles([]);
                          }
                          const newDrizzles = resolveToOptions(v.options.drizzles).map(d => d.name);
                          if (choiceDrizzle && choiceDrizzle.length > 0) {
                            setChoiceDrizzle(choiceDrizzle.filter(d => newDrizzles.includes(d)));
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

              {/* Available Cake Flavors / Dip Flavors selections */}
              {(!hasVariations || selectedVarId) && resolvedCakeFlavors && resolvedCakeFlavors.length > 0 && (() => {
                const isDippedPretzels = selectedProduct.category === "Dipped Pretzels" || selectedProduct.name === "Dipped Pretzels";
                return (
                  <div className="mt-5">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-2">
                      2. {isDippedPretzels ? "Selected Dip Flavor:" : "Selected Cake Flavor:"}
                    </label>
                    <select
                      value={choiceCakeFlavor}
                      onChange={(e) => setChoiceCakeFlavor(e.target.value)}
                      className="w-full border border-brand-pink/20 rounded-xl px-3 py-2 text-xs bg-brand-cream/30 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    >
                      <option value="" disabled>-- {isDippedPretzels ? "Select Dip Flavor" : "Select Cake Flavor"} --</option>
                      {resolvedCakeFlavors.map(cf => (
                        <option key={cf.name} value={cf.name}>
                          {cf.name}{getPriceSuffix(cf.priceAdd)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* Available Frostings selections */}
              {(!hasVariations || selectedVarId) && !isDippedPretzels && resolvedFrostings && resolvedFrostings.length > 0 && (
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
                        {f.name}{getPriceSuffix(f.priceAdd)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected Drizzle selections */}
              {(!hasVariations || selectedVarId) && resolvedDrizzles && resolvedDrizzles.length > 0 && (() => {
                const limit = activeVar?.drizzleSelectionLimit ?? selectedProduct.drizzleSelectionLimit ?? 1;
                return (
                  <div className="mt-5">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1">
                      Choose Available Drizzles:
                    </label>
                    <p className="text-[10px] text-brand-chocolate/60 font-semibold mb-2.5">
                      Choose up to {limit} drizzle{limit > 1 ? "s" : ""}
                    </p>
                    <div className="space-y-2">
                      {resolvedDrizzles.map(d => {
                        const isSelected = choiceDrizzle.includes(d.name);
                        return (
                          <label
                            key={d.name}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-brand-pink/20 border-brand-rosegold font-semibold"
                                : "border-gray-100 hover:bg-brand-cream/50"
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isSelected && choiceDrizzle.length >= limit}
                                onChange={() => {
                                  if (isSelected) {
                                    setChoiceDrizzle(choiceDrizzle.filter(x => x !== d.name));
                                  } else {
                                    if (choiceDrizzle.length < limit) {
                                      setChoiceDrizzle([...choiceDrizzle, d.name]);
                                    }
                                  }
                                }}
                                className="accent-brand-rosegold rounded"
                              />
                              <span>{d.name}</span>
                            </div>
                            <span className="text-brand-rosegold font-semibold">
                              {getPriceLabel(d.priceAdd)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Toppings or Sprinkles selection */}
              {(!hasVariations || selectedVarId) && (() => {
                const isNormalMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && selectedVarId === "normal";
                if (isNormalMiniCakes) {
                  const rawSprinkles = activeVar?.options?.sprinkles !== undefined ? activeVar.options.sprinkles : (activeVar?.options?.toppings || activeVar?.options?.addOns);
                  const resolvedSprinkles = resolveToOptions(rawSprinkles);
                  if (!resolvedSprinkles || resolvedSprinkles.length === 0) return null;
                  const limit = activeVar?.sprinkleSelectionLimit !== undefined ? activeVar.sprinkleSelectionLimit : (activeVar?.toppingSelectionLimit ?? 0);

                  return (
                    <div className="mt-5">
                      <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1">
                        Available Sprinkles:
                      </label>
                      <p className="text-[10px] text-brand-chocolate/60 font-semibold mb-2.5">
                        Choose up to {limit} sprinkle{limit !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-2">
                        {resolvedSprinkles.map(s => {
                          const isSelected = choiceSprinkles.includes(s.name);
                          return (
                            <label
                              key={s.name}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                                isSelected 
                                  ? "bg-brand-pink/15 border-brand-rosegold text-brand-chocolate font-bold" 
                                  : "bg-white border-brand-pink/15 text-brand-chocolate/75 hover:bg-brand-pink/5"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isSelected && choiceSprinkles.length >= limit}
                                  onChange={() => {
                                    if (isSelected) {
                                      setChoiceSprinkles(choiceSprinkles.filter(x => x !== s.name));
                                    } else {
                                      if (choiceSprinkles.length < limit) {
                                        setChoiceSprinkles([...choiceSprinkles, s.name]);
                                      }
                                    }
                                  }}
                                  className="accent-brand-rosegold rounded"
                                />
                                <span>{s.name}</span>
                              </div>
                              <span className="text-brand-rosegold font-semibold">
                                {getPriceLabel(s.priceAdd)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  if (!resolvedToppings || resolvedToppings.length === 0) return null;

                  const isSpecialtyMiniCakes = (selectedProduct.category === "Mini Cakes" || selectedProduct.name === "Mini Cakes") && selectedVarId === "specialty";

                  if (isSpecialtyMiniCakes) {
                    const limit = activeVar?.toppingSelectionLimit ?? selectedProduct.toppingSelectionLimit ?? 2;
                    return (
                      <div className="mt-5">
                        <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block mb-1">
                          AVAILABLE TOPPINGS:
                        </label>
                        <p className="text-[10px] text-brand-chocolate/60 font-semibold mb-2.5">
                          Choose up to {limit} topping{limit !== 1 ? "s" : ""}
                        </p>
                        <div className="space-y-2">
                          {resolvedToppings.map(t => {
                            const isSelected = choiceAddOns.includes(t.name);
                            return (
                              <label
                                key={t.name}
                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                                  isSelected 
                                    ? "bg-brand-pink/15 border-brand-rosegold text-brand-chocolate font-bold" 
                                    : "bg-white border-brand-pink/15 text-brand-chocolate/75 hover:bg-brand-pink/5"
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={!isSelected && choiceAddOns.length >= limit}
                                    onChange={() => {
                                      if (isSelected) {
                                        setChoiceAddOns(choiceAddOns.filter(x => x !== t.name));
                                      } else {
                                        if (choiceAddOns.length < limit) {
                                          setChoiceAddOns([...choiceAddOns, t.name]);
                                        }
                                      }
                                    }}
                                    className="accent-brand-rosegold rounded"
                                  />
                                  <span>{t.name}</span>
                                </div>
                                <span className="text-brand-rosegold font-semibold">
                                  {getPriceLabel(t.priceAdd)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
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
                            {t.name}{getPriceSuffix(t.priceAdd)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
              })()}

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
