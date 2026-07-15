export interface OptionItem {
  name: string;
  priceAdd: number;
}

export interface ProductOptions {
  sizes?: OptionItem[];
  flavors?: string[];
  addOns?: OptionItem[];
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
  photos?: { url: string; isPrimary: boolean }[]; // Multiple photos array
  variations?: ProductVariation[]; // Optional variations list for multi-type products (e.g. Mini Cakes)
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  flavor?: string;
  addOns?: string[];
  unitPrice: number;
  totalPrice: number;
  variationId?: string;
  variationName?: string;
  variationBasePrice?: number;
  sizePriceAdd?: number;
}

export type OrderStatus = "Pending" | "Confirmed" | "In Progress" | "Ready" | "Delivered/Picked Up" | "Cancelled";
export type PaymentStatus = "Unpaid" | "Paid";
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
  deliveryFeePerMile: number;
  taxRate: number; // e.g., 0.0825 for 8.25% in Royse City / TX
  emailTemplateConfirmation: string;
  announcementBanner?: string; // Customizable Announcement Banner text
  bannerVisible?: boolean; // Customizable Announcement Banner visibility
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
}

