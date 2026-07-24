import { dbService } from "../../src/server/db.js";
import { Product, ProductVariation, OptionItem, Coupon, Settings } from "../../src/types.js";

export function toCents(val: number): number {
  return Math.round(val * 100);
}

export function fromCents(val: number): number {
  return val / 100;
}

export function roundCurrency(val: number): number {
  return Math.round(val * 100) / 100;
}

export const resolveToOptions = (rawList: (string | OptionItem)[] | undefined): OptionItem[] => {
  if (!rawList) return [];
  return rawList.map(item => {
    if (typeof item === "string") {
      return { name: item, priceAdd: 0 };
    }
    return {
      name: item?.name || "",
      priceAdd: Number(item?.priceAdd) || 0,
      dozenCount: (item as any)?.dozenCount
    };
  });
};

export function getDozenCount(sizeName: string, sizeObj?: any): number {
  if (sizeObj && typeof sizeObj.dozenCount === "number" && sizeObj.dozenCount > 0) {
    return sizeObj.dozenCount;
  }
  const name = (sizeName || "").toLowerCase().trim();
  if (name === "dozen" || name === "one dozen") return 1;
  if (name === "two dozen") return 2;
  if (name === "three dozen") return 3;
  if (name === "four dozen") return 4;
  if (name === "five dozen") return 5;
  
  console.warn(`[getDozenCount] Could not determine dozen count for size name: "${sizeName}". Defaulting to 1.`);
  return 1;
}

export interface PricingInputItem {
  productId: string;
  variationId?: string;
  quantity: number;
  size?: string;
  selectedCakeFlavors?: string[];
  selectedFrostings?: string[];
  selectedDrizzles?: string[];
  selectedToppings?: string[];
  selectedSprinkles?: string[];
  // Fallbacks for older client fields
  flavor?: string;
  selectedDrizzle?: string;
  addOns?: string[];
}

export function isProductTaxable(product: { category?: string; name?: string; isTaxable?: boolean; taxable?: boolean }): boolean {
  if (typeof product.isTaxable === "boolean") {
    return product.isTaxable;
  }
  if (typeof product.taxable === "boolean") {
    return product.taxable;
  }
  // Default rule: ONLY Mini Cakes are taxable unless explicitly set
  const cat = (product.category || "").toLowerCase().trim();
  const name = (product.name || "").toLowerCase().trim();
  return cat === "mini cakes" || name === "mini cakes" || name.includes("mini cake");
}

export interface PricingResult {
  items: Array<{
    productId: string;
    name: string;
    variationId?: string;
    variationName?: string;
    quantity: number;
    size?: string;
    selectedCakeFlavors?: string[];
    selectedFrostings?: string[];
    selectedDrizzles?: string[];
    selectedToppings?: string[];
    selectedSprinkles?: string[];
    flavor?: string; // Fallback
    unitPrice: number; // in dollars for backward-compatibility
    totalPrice: number; // in dollars for backward-compatibility
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  subtotalCents: number;
  taxableSubtotalCents: number;
  discountAmountCents: number;
  tipAmountCents: number;
  taxAmountCents: number;
  deliveryFeeCents: number;
  totalAmountCents: number;
  taxRate: number;
  couponCode?: string;
}

export async function calculateAuthoritativePricing(
  inputItems: PricingInputItem[],
  couponCode?: string,
  tipSelection?: "none" | "10" | "15" | "20" | "custom",
  customTipAmount?: number,
  fulfillmentType?: "pickup" | "delivery"
): Promise<PricingResult> {
  const products: Product[] = await dbService.list("products");
  const settings: Settings = await dbService.getSettings();

  const verifiedItems: PricingResult["items"] = [];
  let subtotalCents = 0;
  let taxableSubtotalCents = 0;

  for (const inputItem of inputItems) {
    const product = products.find(p => p.id === inputItem.productId);
    if (!product) {
      throw new Error(`Product not found: ${inputItem.productId}`);
    }
    if (product.isVisible === false) {
      throw new Error(`Product is currently unavailable: ${product.name}`);
    }

    // Validate quantity as a positive whole number
    const qty = Math.floor(inputItem.quantity);
    if (isNaN(qty) || qty < 1) {
      throw new Error(`Invalid quantity ${inputItem.quantity} for product: ${product.name}`);
    }

    let activeVar: ProductVariation | undefined;
    if (inputItem.variationId) {
      activeVar = product.variations?.find(v => v.id === inputItem.variationId);
      if (!activeVar) {
        throw new Error(`Invalid variation selected for product: ${product.name}`);
      }
    }

    const activeSizes = activeVar ? (activeVar.options?.sizes || []) : (product.options?.sizes || []);
    let itemUnitPrice = 0;
    let selectedFullPrice: number | null = null;
    let sizePriceModifier = 0;

    const isMiniCakes = product.category === "Mini Cakes" || product.name === "Mini Cakes";
    let dozenCount = 1;
    let addonPrice = 0;

    if (inputItem.size && activeSizes.length > 0) {
      const sizeObj = activeSizes.find(s => s.name === inputItem.size);
      if (!sizeObj) {
        throw new Error(`Invalid size selected: "${inputItem.size}" for product: ${product.name}`);
      }
      
      const isAdditive = sizeObj.name.includes('+') || activeSizes.some(s => Number(s.priceAdd || 0) === 0);
      if (isAdditive) {
        sizePriceModifier = sizeObj.priceAdd || 0;
      } else {
        selectedFullPrice = sizeObj.priceAdd || 0;
      }

      if (isMiniCakes) {
        dozenCount = getDozenCount(inputItem.size, sizeObj);
      }
    }

    if (selectedFullPrice === null) {
      selectedFullPrice = activeVar ? activeVar.basePrice : product.basePrice;
    }

    itemUnitPrice = selectedFullPrice + sizePriceModifier;

    // Validate Cake Flavors
    const rawCakeFlavors = activeVar ? activeVar.options?.cakeFlavors : product.options?.cakeFlavors;
    const resolvedCakeFlavors = resolveToOptions(rawCakeFlavors);
    const selectedCakeFlavors = inputItem.selectedCakeFlavors || [];
    if (selectedCakeFlavors.length > 0 && resolvedCakeFlavors.length > 0) {
      const limit = activeVar?.cakeFlavorSelectionLimit ?? product.cakeFlavorSelectionLimit ?? 1;
      if (selectedCakeFlavors.length > limit) {
        throw new Error(`Cake flavor selection limit exceeded (${limit}) for product: ${product.name}`);
      }
      for (const cfName of selectedCakeFlavors) {
        const cfObj = resolvedCakeFlavors.find(cf => cf.name === cfName);
        if (!cfObj) {
          throw new Error(`Invalid cake flavor selection: "${cfName}" for product: ${product.name}`);
        }
        if (isMiniCakes) {
          addonPrice += cfObj.priceAdd;
        } else {
          itemUnitPrice += cfObj.priceAdd;
        }
      }
    }

    // Validate Frostings (which might be in frostings or flavors config)
    const rawFrostings = activeVar ? (activeVar.options?.frostings || activeVar.options?.flavors) : (product.options?.frostings || product.options?.flavors);
    const resolvedFrostings = resolveToOptions(rawFrostings);
    
    // Normalize frosting preferences (handle multiple, single array, flavor fallback, etc.)
    let selectedFrostings = inputItem.selectedFrostings || [];
    if (selectedFrostings.length === 0 && inputItem.flavor) {
      selectedFrostings = [inputItem.flavor];
    }
    
    if (selectedFrostings.length > 0 && resolvedFrostings.length > 0) {
      const limit = activeVar?.frostingSelectionLimit ?? activeVar?.flavorSelectionLimit ?? product.frostingSelectionLimit ?? product.flavorSelectionLimit ?? 1;
      if (selectedFrostings.length > limit) {
        throw new Error(`Frosting selection limit exceeded (${limit}) for product: ${product.name}`);
      }
      for (const fName of selectedFrostings) {
        const fObj = resolvedFrostings.find(f => f.name === fName);
        if (!fObj) {
          throw new Error(`Invalid frosting selection: "${fName}" for product: ${product.name}`);
        }
        if (isMiniCakes) {
          addonPrice += fObj.priceAdd;
        } else {
          itemUnitPrice += fObj.priceAdd;
        }
      }
    }

    // Validate Drizzles
    const rawDrizzles = activeVar ? activeVar.options?.drizzles : product.options?.drizzles;
    const resolvedDrizzles = resolveToOptions(rawDrizzles);
    const selectedDrizzles = inputItem.selectedDrizzles || (inputItem.selectedDrizzle ? [inputItem.selectedDrizzle] : []);
    if (selectedDrizzles.length > 0 && resolvedDrizzles.length > 0) {
      const limit = activeVar?.drizzleSelectionLimit ?? product.drizzleSelectionLimit ?? 1;
      if (selectedDrizzles.length > limit) {
        throw new Error(`Drizzle selection limit exceeded (${limit}) for product: ${product.name}`);
      }
      for (const dName of selectedDrizzles) {
        const dObj = resolvedDrizzles.find(d => d.name === dName);
        if (!dObj) {
          throw new Error(`Invalid drizzle selection: "${dName}" for product: ${product.name}`);
        }
        if (isMiniCakes) {
          addonPrice += dObj.priceAdd;
        } else {
          itemUnitPrice += dObj.priceAdd;
        }
      }
    }

    // Validate Toppings / Add-ons / Sprinkles
    const isNormalMiniCakes = (product.category === "Mini Cakes" || product.name === "Mini Cakes") && activeVar?.id === "normal";
    let selectedToppings: string[] = [];
    let selectedSprinkles: string[] = [];

    if (isNormalMiniCakes) {
      const rawSprinkles = activeVar?.options?.sprinkles !== undefined ? activeVar.options.sprinkles : (activeVar?.options?.toppings || activeVar?.options?.addOns);
      const resolvedSprinkles = resolveToOptions(rawSprinkles);
      selectedSprinkles = inputItem.selectedSprinkles || inputItem.addOns || [];
      if (selectedSprinkles.length > 0 && resolvedSprinkles.length > 0) {
        const limit = activeVar?.sprinkleSelectionLimit !== undefined ? activeVar.sprinkleSelectionLimit : (activeVar?.toppingSelectionLimit ?? 0);
        if (selectedSprinkles.length > limit) {
          throw new Error(`Sprinkle selection limit exceeded (${limit}) for product: ${product.name}`);
        }
        for (const sName of selectedSprinkles) {
          const sObj = resolvedSprinkles.find(s => s.name === sName);
          if (!sObj) {
            throw new Error(`Invalid sprinkle selection: "${sName}" for product: ${product.name}`);
          }
          if (isMiniCakes) {
            addonPrice += sObj.priceAdd;
          } else {
            itemUnitPrice += sObj.priceAdd;
          }
        }
      }
    } else {
      const rawToppings = activeVar ? (activeVar.options?.toppings || activeVar.options?.addOns) : (product.options?.toppings || product.options?.addOns);
      const resolvedToppings = resolveToOptions(rawToppings);
      selectedToppings = inputItem.selectedToppings || inputItem.addOns || [];
      if (selectedToppings.length > 0 && resolvedToppings.length > 0) {
        const isSpecialtyMiniCakes = isMiniCakes && activeVar?.id === "specialty";
        const limit = activeVar?.toppingSelectionLimit ?? product.toppingSelectionLimit ?? (isSpecialtyMiniCakes ? 2 : 1);
        if (selectedToppings.length > limit) {
          throw new Error(`Topping selection limit exceeded (${limit}) for product: ${product.name}`);
        }
        if (new Set(selectedToppings).size !== selectedToppings.length) {
          throw new Error(`Duplicate topping selection found for product: ${product.name}`);
        }
        for (const tName of selectedToppings) {
          const tObj = resolvedToppings.find(t => t.name === tName);
          if (!tObj) {
            throw new Error(`Invalid topping selection: "${tName}" for product: ${product.name}`);
          }
          if (isMiniCakes) {
            addonPrice += tObj.priceAdd;
          } else {
            itemUnitPrice += tObj.priceAdd;
          }
        }
      }
    }

    if (isMiniCakes) {
      const basePriceCents = toCents(itemUnitPrice);
      const addonSubtotalCents = toCents(addonPrice);
      const scaledAddonTotalCents = addonSubtotalCents * dozenCount;
      const unitPriceCents = basePriceCents + scaledAddonTotalCents;
      itemUnitPrice = fromCents(unitPriceCents);
    }

    const unitPriceCents = toCents(itemUnitPrice);
    const lineTotalCents = unitPriceCents * qty;
    subtotalCents += lineTotalCents;
    if (isProductTaxable(product)) {
      taxableSubtotalCents += lineTotalCents;
    }

    verifiedItems.push({
      productId: product.id,
      name: product.name,
      variationId: activeVar?.id,
      variationName: activeVar?.name,
      quantity: qty,
      size: inputItem.size,
      selectedCakeFlavors: selectedCakeFlavors.length > 0 ? selectedCakeFlavors : undefined,
      selectedFrostings: selectedFrostings.length > 0 ? selectedFrostings : undefined,
      selectedDrizzles: selectedDrizzles.length > 0 ? selectedDrizzles : undefined,
      selectedToppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      selectedSprinkles: selectedSprinkles.length > 0 ? selectedSprinkles : undefined,
      flavor: selectedFrostings[0] || undefined, // Fallback for old orders view
      unitPrice: roundCurrency(itemUnitPrice),
      totalPrice: roundCurrency(itemUnitPrice * qty),
      unitPriceCents,
      lineTotalCents
    });
  }

  // Handle Promo Code / Coupon revalidation
  let discountAmountCents = 0;
  let validatedCouponCode = "";

  if (couponCode) {
    const cleanCode = couponCode.toUpperCase().trim();
    const coupons: Coupon[] = await dbService.list("coupons");
    const coupon = coupons.find(c => c.code === cleanCode);

    if (coupon) {
      const subtotalDollar = fromCents(subtotalCents);
      const today = new Date().toISOString().slice(0, 10);
      let isValid = coupon.isActive;

      if (coupon.expirationDate && today > coupon.expirationDate) {
        isValid = false;
      }
      if (coupon.maxUses !== undefined && coupon.maxUses !== null && (coupon.usageCount || 0) >= coupon.maxUses) {
        isValid = false;
      }
      if (coupon.minOrderAmount && subtotalDollar < coupon.minOrderAmount) {
        isValid = false;
      }

      if (isValid) {
        validatedCouponCode = coupon.code;
        if (coupon.discountType === "percentage") {
          discountAmountCents = Math.round((subtotalCents * coupon.discountValue) / 100);
        } else {
          discountAmountCents = Math.min(toCents(coupon.discountValue), subtotalCents);
        }
      }
    }
  }

  const discountedSubtotalCents = Math.max(0, subtotalCents - discountAmountCents);

  // Handle Tip recalculation
  let tipAmountCents = 0;
  if (tipSelection && tipSelection !== "none") {
    if (tipSelection === "10") {
      tipAmountCents = Math.round((discountedSubtotalCents * 10) / 100);
    } else if (tipSelection === "15") {
      tipAmountCents = Math.round((discountedSubtotalCents * 15) / 100);
    } else if (tipSelection === "20") {
      tipAmountCents = Math.round((discountedSubtotalCents * 20) / 100);
    } else if (tipSelection === "custom" && customTipAmount && customTipAmount > 0) {
      if (isNaN(customTipAmount) || !isFinite(customTipAmount) || customTipAmount < 0) {
        throw new Error("Invalid custom tip amount");
      }
      // Configurable maximum limit of $1000 for safety
      if (customTipAmount > 1000) {
        throw new Error("Custom tip amount is too high");
      }
      tipAmountCents = toCents(customTipAmount);
    }
  }

  // Handle Tax calculation after discount on verified merchandise (ONLY taxable products)
  const discountRatio = subtotalCents > 0 ? (discountAmountCents / subtotalCents) : 0;
  const discountedTaxableSubtotalCents = Math.max(0, Math.round(taxableSubtotalCents * (1 - discountRatio)));
  const taxRate = settings.taxRate || 0.0825;
  const taxAmountCents = Math.round(discountedTaxableSubtotalCents * taxRate);

  // Handle Delivery recalculation
  let deliveryFeeCents = 0;
  if (fulfillmentType === "delivery") {
    const radius = settings.deliveryRadius || 15;
    const feePerMile = settings.deliveryFeePerMile || 2.0;
    const deliveryCostDollar = settings.deliveryFeePerMile ? radius * feePerMile : 15.0;
    deliveryFeeCents = toCents(deliveryCostDollar);
  }

  const totalAmountCents = discountedSubtotalCents + tipAmountCents + taxAmountCents + deliveryFeeCents;

  return {
    items: verifiedItems,
    subtotalCents,
    taxableSubtotalCents,
    discountAmountCents,
    tipAmountCents,
    taxAmountCents,
    deliveryFeeCents,
    totalAmountCents,
    taxRate,
    couponCode: validatedCouponCode || undefined
  };
}

export async function getNextOrderNumber(db: any): Promise<string> {
  const counterRef = db.collection("counters").doc("orderNumbers");
  return await db.runTransaction(async (transaction: any) => {
    const doc = await transaction.get(counterRef);
    let nextNum = 1001;
    if (doc.exists) {
      const data = doc.data();
      nextNum = (data?.currentValue || 1000) + 1;
    }
    transaction.set(counterRef, { currentValue: nextNum }, { merge: true });
    return `LST-${nextNum}`;
  });
}

