export interface OptionItem {
  name: string;
  priceAdd: number;
}

export interface ProductOptions {
  sizes?: OptionItem[];
  flavors?: (string | OptionItem)[];
  cakeFlavors?: (string | OptionItem)[];
  frostings?: (string | OptionItem)[];
  addOns?: OptionItem[];
  toppings?: (string | OptionItem)[];
  drizzles?: (string | OptionItem)[];
  sprinkles?: (string | OptionItem)[];
}

export interface ProductIngredientLink {
  ingredientId: string;
  quantity: number; // e.g., 200 grams, 2 eggs
}

export interface ProductVariation {
  id: string;
  name: string;
  basePrice: number;
  options: ProductOptions;
  description?: string;
  photos?: { url: string; isPrimary: boolean }[];
  flavorSelectionLimit?: number;
  drizzleSelectionLimit?: number;
  toppingSelectionLimit?: number;
  cakeFlavorSelectionLimit?: number;
  frostingSelectionLimit?: number;
  sprinkleSelectionLimit?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  options: ProductOptions;
  ingredients: ProductIngredientLink[];
  imgUrl?: string; // Keep for fallback/backward compatibility
  isVisible?: boolean; // New visible/hidden toggle
  isTaxable?: boolean; // Controls whether product is subject to sales tax
  taxable?: boolean; // Backward compatibility alias
  photos?: { url: string; isPrimary: boolean }[]; // Multiple photos array
  variations?: ProductVariation[]; // Optional variations list for multi-type products (e.g. Mini Cakes)
  flavorSelectionLimit?: number;
  drizzleSelectionLimit?: number;
  toppingSelectionLimit?: number;
  cakeFlavorSelectionLimit?: number;
  frostingSelectionLimit?: number;
  sprinkleSelectionLimit?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  flavor?: string;
  addOns?: string[];
  selectedDrizzle?: string;
  unitPrice: number;
  totalPrice: number;
  variationId?: string;
  variationName?: string;
  variationBasePrice?: number;
  sizePriceAdd?: number;
  selectedFlavors?: string[];
  selectedDrizzles?: string[];
  selectedToppings?: string[];
  selectedSprinkles?: string[];
  selectedCakeFlavors?: string[];
  selectedFrostings?: string[];
  flavorName?: string;
  flavorPricePerDozen?: number;
  selectedDozenQuantity?: number;
  flavorUpchargeTotal?: number;
}

export type OrderStatus = "Pending" | "Confirmed" | "In Progress" | "Ready" | "Delivered/Picked Up" | "Cancelled";
export type PaymentStatus =
  | "Unpaid"
  | "Checkout Created"
  | "Processing"
  | "Paid"
  | "Partially Refunded"
  | "Refunded"
  | "Failed"
  | "Expired"
  | "Disputed";
export type FulfillmentType = "pickup" | "delivery";

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  taxableSubtotal?: number;
  tax: number;
  deliveryFee: number;
  total: number;
  orderDate: string;
  fulfillmentDate: string;
  type: FulfillmentType;
  deliveryAddress?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  couponCode?: string;
  discountAmount?: number;
  tipAmount?: number;

  paymentProvider?: "stripe" | "manual";
  currency?: string;

  subtotalCents?: number;
  taxableSubtotalCents?: number;
  discountAmountCents?: number;
  tipAmountCents?: number;
  taxAmountCents?: number;
  deliveryFeeCents?: number;
  totalAmountCents?: number;
  amountPaidCents?: number;
  amountRefundedCents?: number;
  balanceDueCents?: number;

  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  stripeChargeId?: string;
  stripeReceiptUrl?: string;

  checkoutAttemptId?: string;
  checkoutCreatedAt?: string;
  checkoutExpiresAt?: string;
  paidAt?: string;
  paymentUpdatedAt?: string;
  refundedAt?: string;

  paymentFailureMessage?: string;

  paymentConfirmationApplied?: boolean;
  customerAccountingApplied?: boolean;
  couponUsageApplied?: boolean;
  confirmationApplied?: boolean;

  refunds?: any[];
  auditHistory?: any[];

  pricingSnapshot?: {
    items: OrderItem[];
    subtotalCents: number;
    taxableSubtotalCents?: number;
    discountAmountCents: number;
    tipAmountCents: number;
    taxAmountCents: number;
    deliveryFeeCents: number;
    totalAmountCents: number;
    taxRate: number;
    couponCode?: string;
  };
}

export type QuoteStatus = "Pending Review" | "Sent" | "Accepted" | "Declined";

export interface Quote {
  id: string;
  quoteNumber: string;
  eventType: string;
  eventDate: string;
  servings: number;
  flavorPreferences: string;
  designIdeas: string;
  budgetRange: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: QuoteStatus;
  createdAt: string;
  notes?: string;
  priceProposal?: number;
  proposedItems?: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
  isVIP: boolean;
  notes?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // e.g., "g", "ml", "unit", "lb"
  costPerUnit: number; // cost per single unit of measurement
  stock: number;
}

export interface Settings {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: number;
  deliveryRadius: number;
  deliveryFee?: number;
  deliveryFeePerMile: number;
  taxRate: number; // e.g., 0.0825 for 8.25% in Royse City / TX
  emailTemplateConfirmation: string;
  announcementBanner?: string; // Customizable Announcement Banner text
  bannerVisible?: boolean; // Customizable Announcement Banner visibility
  minimumLeadDays?: number;
  autoEmailTemplate?: string;
  instagramFeedUrls?: string[];
  topBgUrl?: string;
  topBgType?: "image" | "video";
  topBgOpacity?: number; // 0 to 1 range (transparency / opacity)
  bottomBgUrl?: string;
  bottomBgType?: "image" | "video";
  bottomBgOpacity?: number; // 0 to 1 range (transparency / opacity)
}

export type DiscountType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string; // Uppercase, alphanumeric, no spaces
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number;
  expirationDate?: string; // YYYY-MM-DD
  isActive: boolean;
  usageCount: number;
}

export interface BlockedDate {
  id: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: "admin";
}

export interface SelectedOptions {
  size?: string;
  flavor?: string;
  addOns?: string[];
  selectedCakeFlavors?: string[];
  selectedFrostings?: string[];
}

