import { dbService, getDb } from "../src/server/db.js";
import { setCorsHeaders, authenticateAdmin } from "./_lib/helper.js";
import { getStripe } from "./_lib/stripe.js";
import { calculateAuthoritativePricing, getNextOrderNumber, toCents, fromCents, roundCurrency } from "./_lib/order-pricing.js";
import { Order, BlockedDate } from "../src/types.js";

// Safe helper to extract matched action across both Vercel and local dev server environments
function getAction(req: any): string {
  const candidates = [
    req.url,
    req.headers["x-matched-path"],
    req.headers["x-forwarded-url"],
    req.headers["x-original-url"]
  ];
  for (const cand of candidates) {
    if (!cand) continue;
    const pathname = cand.split("?")[0];
    const parts = pathname.split("/").filter(Boolean);
    const stripeIdx = parts.indexOf("stripe");
    if (stripeIdx !== -1 && parts[stripeIdx + 1]) {
      const act = parts[stripeIdx + 1];
      if (!act.endsWith(".ts") && !act.endsWith(".js")) {
        return act;
      }
    }
    const last = parts[parts.length - 1];
    if (last && last !== "stripe" && !last.endsWith(".ts") && !last.endsWith(".js")) {
      return last;
    }
  }
  return "";
}

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const action = getAction(req);
    console.log(`[Stripe API Match] Path: ${req.url}, Matched Action: ${action}`);

    // Retrieve and validate environment configuration
    const stripeCurrency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
    if (!stripeCurrency || stripeCurrency.length !== 3) {
      throw new Error(`Invalid STRIPE_CURRENCY configuration: "${stripeCurrency}"`);
    }

    const appBaseUrl = process.env.APP_BASE_URL || `http://${req.headers.host || "localhost"}`;

    // Action 1: Create Stripe Checkout Session
    if (action === "create-checkout-session" && req.method === "POST") {
      const {
        customerName,
        customerEmail,
        customerPhone,
        fulfillmentDate,
        fulfillmentType,
        deliveryAddress,
        notes,
        promoCode,
        tipSelection,
        customTip,
        cart
      } = req.body;

      if (!customerName || !customerEmail || !customerPhone || !fulfillmentDate || !fulfillmentType || !cart || cart.length === 0) {
        return res.status(400).json({ error: "Missing required checkout parameters." });
      }

      // Check Lead Time validation
      const settings = await dbService.getSettings();
      const minNotice = settings.leadTimeDays || 3;
      const proposedDate = new Date(fulfillmentDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + minNotice);
      proposedDate.setHours(0,0,0,0);
      minDate.setHours(0,0,0,0);

      if (proposedDate < minDate) {
        return res.status(400).json({ 
          error: `Minimum ordering lead time is ${minNotice} days. First available date is ${minDate.toISOString().slice(0, 10)}.` 
        });
      }

      // Blocked Dates Check
      const blockedDates: BlockedDate[] = await dbService.list("blockedDates");
      const isBlocked = blockedDates.some(b => b.date === fulfillmentDate);
      if (isBlocked) {
        return res.status(400).json({ error: "Sorry, this date is unavailable for baking. Please choose another date!" });
      }

      // Daily Capacity Check (Max 10 orders per day)
      const allOrders: Order[] = await dbService.list("orders");
      const nowTime = new Date().getTime();
      const activeOrdersOnDay = allOrders.filter(o => {
        if (o.fulfillmentDate !== fulfillmentDate || o.status === "Cancelled") return false;
        if (o.paymentStatus === "Paid" || o.paymentStatus === "Unpaid") return true;
        if (o.paymentStatus === "Checkout Created" && o.checkoutExpiresAt) {
          return new Date(o.checkoutExpiresAt).getTime() > nowTime;
        }
        return false;
      });

      if (activeOrdersOnDay.length >= 10) {
        return res.status(400).json({ 
          error: "Baking capacity limit reached (maximum 10 orders) for this date. Lainie is fully booked! Please select another date for your sweet treats." 
        });
      }

      // Run authoritative pricing calculation
      const pricing = await calculateAuthoritativePricing(
        cart,
        promoCode,
        tipSelection,
        customTip,
        fulfillmentType
      );

      // Create a unique sequencer-safe Order Number and ID inside Firestore
      const db = getDb();
      const orderNumber = await getNextOrderNumber(db);
      const orderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Setup Stripe line items
      const stripe = getStripe();
      const lineItems: any[] = [];

      for (const item of pricing.items) {
        const descParts: string[] = [];
        if (item.size) descParts.push(`Size: ${item.size}`);
        if (item.selectedCakeFlavors && item.selectedCakeFlavors.length > 0) {
          if ((item as any).flavorUpchargeTotal && (item as any).flavorUpchargeTotal > 0) {
            descParts.push(`Cake Flavor: ${item.selectedCakeFlavors.join(", ")} (+$${(item as any).flavorPricePerDozen} per dozen x ${(item as any).selectedDozenQuantity} dozen = +$${(item as any).flavorUpchargeTotal})`);
          } else {
            descParts.push(`Cake Flavor: ${item.selectedCakeFlavors.join(", ")}`);
          }
        }
        if (item.selectedFrostings && item.selectedFrostings.length > 0) {
          descParts.push(`Frosting: ${item.selectedFrostings.join(", ")}`);
        } else if (item.flavor) {
          descParts.push(`Frosting: ${item.flavor}`);
        }
        if (item.selectedDrizzles && item.selectedDrizzles.length > 0) {
          if ((item as any).drizzleUpchargeTotal && (item as any).drizzleUpchargeTotal > 0) {
            descParts.push(`Drizzle: ${item.selectedDrizzles.join(", ")} (+$${(item as any).drizzlePricePerDozen} per dozen x ${(item as any).selectedDozenQuantity} dozen = +$${(item as any).drizzleUpchargeTotal})`);
          } else {
            descParts.push(`Drizzle: ${item.selectedDrizzles.join(", ")}`);
          }
        }
        if (item.selectedToppings && item.selectedToppings.length > 0) {
          if ((item as any).toppingUpchargeTotal && (item as any).toppingUpchargeTotal > 0) {
            descParts.push(`Toppings: ${item.selectedToppings.join(", ")} (+$${(item as any).toppingPricePerDozen} per dozen x ${(item as any).selectedDozenQuantity} dozen = +$${(item as any).toppingUpchargeTotal})`);
          } else {
            descParts.push(`Toppings: ${item.selectedToppings.join(", ")}`);
          }
        }
        if (item.selectedSprinkles && item.selectedSprinkles.length > 0) {
          descParts.push(`Sprinkles: ${item.selectedSprinkles.join(", ")}`);
        }

        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: item.name + (item.variationName ? ` (${item.variationName})` : ""),
              description: descParts.length > 0 ? descParts.join(" | ") : undefined,
            },
            unit_amount: item.unitPriceCents,
          },
          quantity: item.quantity,
        });
      }

      // If Tip is selected
      if (pricing.tipAmountCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: "Baking Tip",
              description: "To support Lainie's custom bakery bakes",
            },
            unit_amount: pricing.tipAmountCents,
          },
          quantity: 1,
        });
      }

      // If Tax is present
      if (pricing.taxAmountCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Sales Tax (${(pricing.taxRate * 100).toFixed(2)}%)`,
              description: "Local sales tax on merchandise",
            },
            unit_amount: pricing.taxAmountCents,
          },
          quantity: 1,
        });
      }

      // If Delivery Fee is present
      if (pricing.deliveryFeeCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: "Local Delivery Fee",
              description: `Fulfillment Delivery Address: ${deliveryAddress}`,
            },
            unit_amount: pricing.deliveryFeeCents,
          },
          quantity: 1,
        });
      }

      // Prepare discounts/coupons via Stripe Ephemeral Coupon
      const discounts: any[] = [];
      if (pricing.discountAmountCents > 0) {
        const stripeCoupon = await stripe.coupons.create({
          amount_off: pricing.discountAmountCents,
          currency: stripeCurrency,
          duration: "once",
          name: `Promo Code: ${pricing.couponCode}`
        });
        discounts.push({ coupon: stripeCoupon.id });
      }

      const checkoutAttemptId = `chk-${Date.now()}`;
      const expiresAtMs = Date.now() + 30 * 60 * 1000; // 30 minutes

      // Create Stripe checkout session with robust error handling
      let session: any;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: customerEmail.toLowerCase(),
          line_items: lineItems,
          discounts: discounts.length > 0 ? discounts : undefined,
          client_reference_id: orderId,
          metadata: {
            orderId,
            orderNumber,
            checkoutAttemptId
          },
          payment_intent_data: {
            metadata: {
              orderId,
              orderNumber
            }
          },
          success_url: `${appBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appBaseUrl}/?payment=cancelled&orderId=${orderId}`,
          expires_at: Math.floor(expiresAtMs / 1000)
        });
      } catch (stripeErr: any) {
        console.error("[Stripe Session Creation Failed]:", stripeErr);
        return res.status(400).json({ error: `Stripe payment session creation failed: ${stripeErr.message}` });
      }

      const actualExpiresAt = new Date(session.expires_at * 1000).toISOString();

      // Construct and save the pending Order Document in Firestore
      const newOrder: Order = {
        id: orderId,
        orderNumber,
        customerId: "", 
        customerName,
        customerEmail: customerEmail.toLowerCase(),
        customerPhone,
        items: pricing.items as any,
        subtotal: roundCurrency(fromCents(pricing.subtotalCents)),
        taxableSubtotal: roundCurrency(fromCents(pricing.taxableSubtotalCents)),
        tax: roundCurrency(fromCents(pricing.taxAmountCents)),
        deliveryFee: roundCurrency(fromCents(pricing.deliveryFeeCents)),
        total: roundCurrency(fromCents(pricing.totalAmountCents)),
        discountAmount: pricing.discountAmountCents > 0 ? roundCurrency(fromCents(pricing.discountAmountCents)) : undefined,
        tipAmount: pricing.tipAmountCents > 0 ? roundCurrency(fromCents(pricing.tipAmountCents)) : undefined,
        orderDate: new Date().toISOString(),
        fulfillmentDate,
        type: fulfillmentType,
        deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : undefined,
        status: "Pending",
        paymentStatus: "Checkout Created",
        notes,
        couponCode: pricing.couponCode,

        paymentProvider: "stripe",
        currency: stripeCurrency,
        subtotalCents: pricing.subtotalCents,
        taxableSubtotalCents: pricing.taxableSubtotalCents,
        discountAmountCents: pricing.discountAmountCents,
        tipAmountCents: pricing.tipAmountCents,
        taxAmountCents: pricing.taxAmountCents,
        deliveryFeeCents: pricing.deliveryFeeCents,
        totalAmountCents: pricing.totalAmountCents,
        balanceDueCents: pricing.totalAmountCents,
        amountPaidCents: 0,
        amountRefundedCents: 0,

        stripeCheckoutSessionId: session.id,
        checkoutAttemptId,
        checkoutCreatedAt: new Date().toISOString(),
        checkoutExpiresAt: actualExpiresAt
      };

      await dbService.insert("orders", newOrder);

      return res.status(200).json({
        checkoutUrl: session.url,
        orderId,
        orderNumber,
        expiresAt: actualExpiresAt
      });
    }

    // Action 2: Check status of Stripe checkout session
    if (action === "checkout-status" && req.method === "GET") {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return res.status(400).json({ error: "session_id query parameter is required." });
      }

      const stripe = getStripe();
      let session: any;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (stripeErr: any) {
        return res.status(400).json({ error: `Stripe Session retrieval failed: ${stripeErr.message}` });
      }

      const orderId = session.client_reference_id;
      if (!orderId) {
        return res.status(404).json({ error: "Order details not linked on session." });
      }

      const order: Order | null = await dbService.get("orders", orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      // Verify that the supplied session ID belongs to the returned order
      if (order.stripeCheckoutSessionId !== sessionId) {
        return res.status(400).json({ error: "The provided session ID does not belong to this order." });
      }

      // Fallback verification: if Stripe payment is paid but order is not, verify synchronously
      if (session.payment_status === "paid" && order.paymentStatus !== "Paid") {
        console.log(`[Status Sync] Session paid, running inline validation for order: ${orderId}`);
        const verifyRes = await verifyAndConfirmStripePayment(orderId, session.id, session.payment_intent as string);
        if (!verifyRes.success) {
          return res.status(400).json({ error: `Payment verification failed: ${verifyRes.error}` });
        }
      }

      // Fetch fresh order details
      const freshOrder: Order | null = await dbService.get("orders", orderId);
      if (!freshOrder) {
        return res.status(404).json({ error: "Order not found." });
      }

      // Return a sanitized public payment-status response
      const safeItems = (freshOrder.items || []).map((item: any) => ({
        name: item.name,
        variationName: item.variationName || null,
        quantity: item.quantity,
        size: item.size || null,
        selectedCakeFlavors: item.selectedCakeFlavors || null,
        selectedFrostings: item.selectedFrostings || null,
        selectedDrizzles: item.selectedDrizzles || null,
        selectedToppings: item.selectedToppings || null,
        selectedSprinkles: item.selectedSprinkles || null
      }));

      const firstName = freshOrder.customerName ? freshOrder.customerName.split(" ")[0] : "";

      const sanitizedResponse = {
        orderNumber: freshOrder.orderNumber,
        paymentStatus: freshOrder.paymentStatus,
        amountPaid: freshOrder.total,
        amountPaidCents: freshOrder.amountPaidCents,
        totalAmountCents: freshOrder.totalAmountCents,
        fulfillmentDate: freshOrder.fulfillmentDate,
        fulfillmentType: freshOrder.type,
        items: safeItems,
        customerFirstName: firstName,
        retryEligibility: freshOrder.paymentStatus !== "Paid" && freshOrder.status !== "Cancelled"
      };

      return res.status(200).json(sanitizedResponse);
    }

    // Action 3: Retry/Re-verify payment for a pending or failed checkout
    if (action === "retry-payment" && req.method === "POST") {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required." });
      }

      const order: Order | null = await dbService.get("orders", orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      if (order.paymentStatus === "Paid") {
        return res.status(400).json({ error: "This order is already paid.", order });
      }

      // Revalidate dates and daily capacity limits
      const settings = await dbService.getSettings();
      const minNotice = settings.leadTimeDays || 3;
      const proposedDate = new Date(order.fulfillmentDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + minNotice);
      proposedDate.setHours(0,0,0,0);
      minDate.setHours(0,0,0,0);

      if (proposedDate < minDate) {
        return res.status(400).json({ 
          error: `The fulfillment date has passed or doesn't meet the lead time of ${minNotice} days anymore.` 
        });
      }

      const blockedDates: BlockedDate[] = await dbService.list("blockedDates");
      if (blockedDates.some(b => b.date === order.fulfillmentDate)) {
        return res.status(400).json({ error: "This date is blocked for baking." });
      }

      // Revalidate daily capacity (ignoring this order itself!)
      const allOrders: Order[] = await dbService.list("orders");
      const nowTime = new Date().getTime();
      const activeOrdersOnDay = allOrders.filter(o => {
        if (o.id === orderId) return false;
        if (o.fulfillmentDate !== order.fulfillmentDate || o.status === "Cancelled") return false;
        if (o.paymentStatus === "Paid" || o.paymentStatus === "Unpaid") return true;
        if (o.paymentStatus === "Checkout Created" && o.checkoutExpiresAt) {
          return new Date(o.checkoutExpiresAt).getTime() > nowTime;
        }
        return false;
      });

      if (activeOrdersOnDay.length >= 10) {
        return res.status(400).json({ 
          error: "Baking capacity limit reached (maximum 10 orders) for this date. Lainie is fully booked! Please select another date." 
        });
      }

      // Reconstruct a clean selection-only cart payload
      const selectionCart: any[] = (order.items || []).map((item: any) => ({
        productId: item.productId,
        variationId: item.variationId || undefined,
        quantity: item.quantity,
        size: item.size || undefined,
        selectedCakeFlavors: item.selectedCakeFlavors || undefined,
        selectedFrostings: item.selectedFrostings || undefined,
        selectedDrizzles: item.selectedDrizzles || undefined,
        selectedToppings: item.selectedToppings || undefined,
        selectedSprinkles: item.selectedSprinkles || undefined
      }));

      // Revalidate pricing, coupons, options, fulfillment date, and capacity
      const pricing = await calculateAuthoritativePricing(
        selectionCart,
        order.couponCode,
        order.tipAmountCents ? "custom" : "none",
        order.tipAmountCents ? fromCents(order.tipAmountCents) : 0,
        order.type
      );

      const totalChanged = pricing.totalAmountCents !== order.totalAmountCents;

      // Expire previous checkout session if possible
      if (order.stripeCheckoutSessionId) {
        try {
          const stripe = getStripe();
          await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
          console.log(`[Stripe Expire] Expired old session: ${order.stripeCheckoutSessionId}`);
        } catch (e) {
          console.log(`[Stripe Expire Warning] Could not expire old session:`, e);
        }
      }

      // Rebuild Stripe checkout session
      const stripe = getStripe();
      const lineItems: any[] = [];
      for (const item of pricing.items) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: item.name + (item.variationName ? ` (${item.variationName})` : ""),
            },
            unit_amount: item.unitPriceCents,
          },
          quantity: item.quantity,
        });
      }

      if (pricing.tipAmountCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: { name: "Baking Tip" },
            unit_amount: pricing.tipAmountCents,
          },
          quantity: 1,
        });
      }
      if (pricing.taxAmountCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: { name: `Sales Tax (${(pricing.taxRate * 100).toFixed(2)}%)` },
            unit_amount: pricing.taxAmountCents,
          },
          quantity: 1,
        });
      }
      if (pricing.deliveryFeeCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: { name: "Local Delivery Fee" },
            unit_amount: pricing.deliveryFeeCents,
          },
          quantity: 1,
        });
      }

      const discounts: any[] = [];
      if (pricing.discountAmountCents > 0) {
        const stripeCoupon = await stripe.coupons.create({
          amount_off: pricing.discountAmountCents,
          currency: stripeCurrency,
          duration: "once",
          name: `Promo Code: ${pricing.couponCode}`
        });
        discounts.push({ coupon: stripeCoupon.id });
      }

      const checkoutAttemptId = `chk-${Date.now()}`;
      const expiresAtMs = Date.now() + 30 * 60 * 1000;

      let session: any;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: order.customerEmail,
          line_items: lineItems,
          discounts: discounts.length > 0 ? discounts : undefined,
          client_reference_id: orderId,
          metadata: {
            orderId,
            orderNumber: order.orderNumber,
            checkoutAttemptId
          },
          payment_intent_data: {
            metadata: {
              orderId,
              orderNumber: order.orderNumber
            }
          },
          success_url: `${appBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appBaseUrl}/?payment=cancelled&orderId=${orderId}`,
          expires_at: Math.floor(expiresAtMs / 1000)
        });
      } catch (stripeErr: any) {
        console.error("[Stripe Session Creation Failed]:", stripeErr);
        return res.status(400).json({ error: `Stripe payment session creation failed: ${stripeErr.message}` });
      }

      const actualExpiresAt = new Date(session.expires_at * 1000).toISOString();

      // Update Order document in Firestore
      const updatedFields: Partial<Order> = {
        stripeCheckoutSessionId: session.id,
        checkoutAttemptId,
        checkoutCreatedAt: new Date().toISOString(),
        checkoutExpiresAt: actualExpiresAt,
        paymentStatus: "Checkout Created"
      };

      if (totalChanged) {
        updatedFields.subtotal = roundCurrency(fromCents(pricing.subtotalCents));
        updatedFields.taxableSubtotal = roundCurrency(fromCents(pricing.taxableSubtotalCents));
        updatedFields.tax = roundCurrency(fromCents(pricing.taxAmountCents));
        updatedFields.deliveryFee = roundCurrency(fromCents(pricing.deliveryFeeCents));
        updatedFields.total = roundCurrency(fromCents(pricing.totalAmountCents));
        updatedFields.discountAmount = pricing.discountAmountCents > 0 ? roundCurrency(fromCents(pricing.discountAmountCents)) : undefined;
        updatedFields.tipAmount = pricing.tipAmountCents > 0 ? roundCurrency(fromCents(pricing.tipAmountCents)) : undefined;

        updatedFields.subtotalCents = pricing.subtotalCents;
        updatedFields.taxableSubtotalCents = pricing.taxableSubtotalCents;
        updatedFields.discountAmountCents = pricing.discountAmountCents;
        updatedFields.tipAmountCents = pricing.tipAmountCents;
        updatedFields.taxAmountCents = pricing.taxAmountCents;
        updatedFields.deliveryFeeCents = pricing.deliveryFeeCents;
        updatedFields.totalAmountCents = pricing.totalAmountCents;
        updatedFields.balanceDueCents = pricing.totalAmountCents;
      }

      await dbService.update("orders", orderId, updatedFields);

      return res.status(200).json({
        checkoutUrl: session.url,
        orderId,
        orderNumber: order.orderNumber,
        totalChanged
      });
    }

    // Action 4: Refund (Admin protected)
    if (action === "refund" && req.method === "POST") {
      const admin = authenticateAdmin(req, res);
      if (!admin) return;

      const { orderId, amount } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required." });
      }

      const order: Order | null = await dbService.get("orders", orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      if (!order.stripePaymentIntentId) {
        return res.status(400).json({ error: "This order does not have a Stripe Payment Intent ID." });
      }

      const maxRefundableCents = (order.amountPaidCents || 0) - (order.amountRefundedCents || 0);
      let refundAmountCents = maxRefundableCents;

      if (amount !== undefined) {
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) {
          return res.status(400).json({ error: "Refund amount must be a positive number." });
        }
        refundAmountCents = toCents(amt);
        if (refundAmountCents > maxRefundableCents) {
          return res.status(400).json({ 
            error: `Requested refund ($${amt.toFixed(2)}) exceeds maximum remaining refundable balance ($${fromCents(maxRefundableCents).toFixed(2)}).` 
          });
        }
      }

      const stripe = getStripe();
      let refund: any;
      try {
        refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: refundAmountCents,
          metadata: {
            orderId,
            orderNumber: order.orderNumber
          }
        }, {
          idempotencyKey: `ref-${orderId}-${refundAmountCents}-${Date.now()}`
        });
      } catch (stripeErr: any) {
        return res.status(400).json({ error: `Stripe refund creation failed: ${stripeErr.message}` });
      }

      // Update Order document in Firestore - save pending refund record
      const db = getDb();
      const orderRef = db.collection("orders").doc(orderId);
      
      const updatedOrder = await db.runTransaction(async (transaction: any) => {
        const snap = await transaction.get(orderRef);
        if (!snap.exists) throw new Error("Order not found inside transaction");
        const ord = snap.data() as Order;
        
        const refunds = ord.refunds || [];
        refunds.push({
          stripeRefundId: refund.id,
          requestedAmountCents: refundAmountCents,
          status: "pending",
          requestedAt: new Date().toISOString(),
          requestedBy: admin.email || "admin"
        });

        const auditHistory = ord.auditHistory || [];
        auditHistory.push({
          action: "refund_requested",
          amountCents: refundAmountCents,
          stripeRefundId: refund.id,
          timestamp: new Date().toISOString(),
          details: `Requested Stripe refund of $${fromCents(refundAmountCents).toFixed(2)}`
        });

        transaction.update(orderRef, {
          refunds,
          auditHistory,
          paymentUpdatedAt: new Date().toISOString()
        });

        return { ...ord, refunds, auditHistory };
      });

      return res.status(200).json({ success: true, refund, order: updatedOrder });
    }

    // Action 5: Test Connection (Admin protected)
    if (action === "test-connection" && req.method === "POST") {
      const admin = authenticateAdmin(req, res);
      if (!admin) return;

      const stripe = getStripe();
      await stripe.paymentIntents.list({ limit: 1 });
      return res.status(200).json({ success: true, mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test" : "live" });
    }

    // Action 6: Sync order status from Stripe manually (Admin protected)
    if (action === "sync-order" && req.method === "POST") {
      const admin = authenticateAdmin(req, res);
      if (!admin) return;

      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required." });
      }

      const order: Order | null = await dbService.get("orders", orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      if (!order.stripeCheckoutSessionId) {
        return res.status(400).json({ error: "This order is not a Stripe order." });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);

      if (session.payment_status === "paid" && order.paymentStatus !== "Paid") {
        const verifyRes = await verifyAndConfirmStripePayment(orderId, session.id, session.payment_intent as string);
        if (!verifyRes.success) {
          return res.status(400).json({ error: `Sync validation failed: ${verifyRes.error}` });
        }
        const syncedOrder = await dbService.get("orders", orderId);
        return res.status(200).json({ message: "Synchronized successfully! Order is marked Paid.", order: syncedOrder });
      }

      return res.status(200).json({ message: "Order is already in sync with Stripe.", order });
    }

    return res.status(404).json({ error: "Action not supported or incorrect route." });
  } catch (error: any) {
    console.error("[Stripe API Error]:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}

/**
 * Robust payment verification and accounting path.
 */
export async function verifyAndConfirmStripePayment(
  orderId: string,
  sessionId?: string,
  paymentIntentId?: string
): Promise<{ success: boolean; error?: string }> {
  const stripeCurrency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
  
  const order: Order | null = await dbService.get("orders", orderId);
  if (!order) {
    console.error(`[Verification Failed] Order not found: ${orderId}`);
    return { success: false, error: "Order not found" };
  }

  try {
    const stripe = getStripe();
    
    let session: any;
    const sId = sessionId || order.stripeCheckoutSessionId;
    if (!sId) {
      const err = `No Stripe Checkout Session linked to order ${orderId}`;
      console.error(`[Verification Failed] ${err}`);
      await dbService.update("orders", orderId, {
        paymentStatus: "Failed",
        paymentFailureMessage: err,
        paymentUpdatedAt: new Date().toISOString()
      });
      return { success: false, error: err };
    }

    session = await stripe.checkout.sessions.retrieve(sId);

    const refId = session.client_reference_id;
    const metaOrderId = session.metadata?.orderId;
    if (refId !== orderId && metaOrderId !== orderId) {
      const err = `Client reference ID (${refId}) or metadata orderId (${metaOrderId}) does not match order ID (${orderId})`;
      console.error(`[Verification Failed] ${err}`);
      await dbService.update("orders", orderId, {
        paymentStatus: "Failed",
        paymentFailureMessage: err,
        paymentUpdatedAt: new Date().toISOString()
      });
      return { success: false, error: err };
    }

    const sessionCurrency = (session.currency || "usd").toLowerCase();
    const orderCurrency = (order.currency || "usd").toLowerCase();
    
    if (sessionCurrency !== orderCurrency || sessionCurrency !== stripeCurrency) {
      const err = `Currency mismatch. Expected ${orderCurrency} (config: ${stripeCurrency}), but Stripe session had ${sessionCurrency}`;
      console.error(`[Verification Failed] ${err}`);
      await dbService.update("orders", orderId, {
        paymentStatus: "Failed",
        paymentFailureMessage: err,
        paymentUpdatedAt: new Date().toISOString()
      });
      return { success: false, error: err };
    }

    const sessionAmount = session.amount_total;
    const expectedAmount = order.totalAmountCents;
    if (sessionAmount !== expectedAmount) {
      const err = `Amount mismatch. Expected ${expectedAmount} cents, but received ${sessionAmount} cents in Stripe session.`;
      console.error(`[Verification Failed] ${err}`);
      await dbService.update("orders", orderId, {
        paymentStatus: "Failed",
        paymentFailureMessage: err,
        paymentUpdatedAt: new Date().toISOString()
      });
      return { success: false, error: err };
    }

    if (session.payment_status !== "paid") {
      const err = `Stripe session payment_status is ${session.payment_status}, not 'paid'.`;
      console.error(`[Verification Failed] ${err}`);
      return { success: false, error: err };
    }

    const sessionPI = session.payment_intent as string;
    const givenPI = paymentIntentId || order.stripePaymentIntentId;
    if (givenPI && sessionPI && givenPI !== sessionPI) {
      const err = `PaymentIntent mismatch. Expected ${sessionPI} from session, but got ${givenPI}`;
      console.error(`[Verification Failed] ${err}`);
      await dbService.update("orders", orderId, {
        paymentStatus: "Failed",
        paymentFailureMessage: err,
        paymentUpdatedAt: new Date().toISOString()
      });
      return { success: false, error: err };
    }

    const piToUse = sessionPI || givenPI || "";
    await confirmSuccessfulOrderPayment(orderId, session.id, piToUse);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.message || "Unknown verification error";
    console.error(`[Verification Crash] Order ${orderId}:`, err);
    await dbService.update("orders", orderId, {
      paymentStatus: "Failed",
      paymentFailureMessage: `Verification Crash: ${errorMsg}`,
      paymentUpdatedAt: new Date().toISOString()
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Shared order confirmation and customer CRM accounting routine.
 * Executes exactly once safely (idempotent) with independent flags inside a transaction.
 */
export async function confirmSuccessfulOrderPayment(orderId: string, checkoutSessionId: string, paymentIntentId: string) {
  const db = getDb();
  
  await db.runTransaction(async (transaction: any) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new Error(`Order ${orderId} does not exist during transaction.`);
    }

    const order: Order = orderSnap.data() as Order;

    // Read customers inside transaction first
    const customersRef = db.collection("customers");
    const customerQuery = customersRef.where("email", "==", order.customerEmail.toLowerCase());
    const customerQuerySnap = await transaction.get(customerQuery);

    // Read coupon inside transaction first
    let couponDoc: any = null;
    if (order.couponCode && !order.couponUsageApplied) {
      const cleanCouponCode = order.couponCode.toUpperCase().trim();
      const couponsRef = db.collection("coupons");
      const couponQuery = couponsRef.where("code", "==", cleanCouponCode);
      const couponQuerySnap = await transaction.get(couponQuery);
      if (!couponQuerySnap.empty) {
        couponDoc = couponQuerySnap.docs[0];
      }
    }

    const updatePayload: any = {};

    // 1. Mark Payment Status
    if (!order.paymentConfirmationApplied) {
      const totalCents = order.totalAmountCents || toCents(order.total || 0);
      updatePayload.paymentStatus = "Paid";
      updatePayload.status = "Confirmed";
      updatePayload.stripeCheckoutSessionId = checkoutSessionId;
      updatePayload.stripePaymentIntentId = paymentIntentId || "";
      updatePayload.amountPaidCents = totalCents;
      updatePayload.balanceDueCents = 0;
      updatePayload.paidAt = new Date().toISOString();
      updatePayload.paymentUpdatedAt = new Date().toISOString();
      updatePayload.paymentConfirmationApplied = true;
    }

    // 2. Customer CRM update
    if (!order.customerAccountingApplied) {
      let customerId = order.customerId;
      const amountSpent = order.total;

      if (!customerQuerySnap.empty) {
        const existingCustomerDoc = customerQuerySnap.docs[0];
        customerId = existingCustomerDoc.id;
        const existingCustomer = existingCustomerDoc.data();
        const customerRef = db.collection("customers").doc(customerId);
        transaction.update(customerRef, {
          orderCount: (existingCustomer.orderCount || 0) + 1,
          totalSpent: parseFloat(((existingCustomer.totalSpent || 0) + amountSpent).toFixed(2)),
          lastOrderDate: order.fulfillmentDate
        });
      } else {
        const newCustRef = db.collection("customers").doc();
        customerId = newCustRef.id;
        transaction.set(newCustRef, {
          id: customerId,
          name: order.customerName,
          email: order.customerEmail.toLowerCase(),
          phone: order.customerPhone,
          orderCount: 1,
          totalSpent: amountSpent,
          lastOrderDate: order.fulfillmentDate,
          isVIP: false,
          notes: "Auto-created on Stripe checkout payment completion."
        });
      }

      updatePayload.customerId = customerId;
      updatePayload.customerAccountingApplied = true;
    }

    // 3. Increment Coupon utilization count exactly once
    if (couponDoc) {
      const couponToInc = couponDoc.data();
      const couponRef = db.collection("coupons").doc(couponDoc.id);
      transaction.update(couponRef, {
        usageCount: (couponToInc.usageCount || 0) + 1
      });
      updatePayload.couponUsageApplied = true;
    }

    // 4. Record dynamic order confirmation flag
    if (!order.confirmationApplied) {
      updatePayload.confirmationApplied = true;
    }

    if (Object.keys(updatePayload).length > 0) {
      transaction.update(orderRef, updatePayload);
    }
    console.log(`🍰 Payment confirmed successfully for Order: ${order.orderNumber} (Id: ${orderId})`);
  });
}

/**
 * Reconciles refunds from both webhook deliveries and manual checks securely.
 */
export async function reconcileStripeRefund(
  orderId: string,
  stripeRefundId: string,
  stripeRefundStatus: string,
  actualRefundedAmountCents: number
) {
  const db = getDb();
  await db.runTransaction(async (transaction: any) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) return;

    const order = orderSnap.data() as Order;
    
    let refunds = order.refunds || [];
    let rIdx = refunds.findIndex((r: any) => r.stripeRefundId === stripeRefundId);
    
    if (rIdx === -1) {
      refunds.push({
        stripeRefundId,
        requestedAmountCents: actualRefundedAmountCents,
        status: "pending",
        requestedAt: new Date().toISOString(),
        requestedBy: "webhook"
      });
      rIdx = refunds.length - 1;
    }

    const currentRefund = refunds[rIdx];

    if (currentRefund.status === "succeeded" || currentRefund.status === "failed") {
      return;
    }

    if (stripeRefundStatus === "succeeded") {
      currentRefund.status = "succeeded";
      currentRefund.finalizedAt = new Date().toISOString();

      // Deduct spent on success exactly once
      if (order.customerId && !currentRefund.customerSpentDeducted) {
        const customerRef = db.collection("customers").doc(order.customerId);
        const customerSnap = await transaction.get(customerRef);
        if (customerSnap.exists) {
          const customer = customerSnap.data();
          const refundAmountDollar = fromCents(actualRefundedAmountCents);
          transaction.update(customerRef, {
            totalSpent: Math.max(0, roundCurrency((customer.totalSpent || 0) - refundAmountDollar))
          });
        }
        currentRefund.customerSpentDeducted = true;
      }

      // Add audit history record
      const auditLog = order.auditHistory || [];
      auditLog.push({
        action: "refund_succeeded",
        amountCents: actualRefundedAmountCents,
        stripeRefundId,
        timestamp: new Date().toISOString(),
        details: `Stripe refund of $${fromCents(actualRefundedAmountCents).toFixed(2)} succeeded.`
      });

      const totalRefundedCents = (order.amountRefundedCents || 0) + actualRefundedAmountCents;
      const nextBalanceDueCents = Math.max(0, (order.amountPaidCents || 0) - totalRefundedCents);
      const nextPaymentStatus = totalRefundedCents >= (order.amountPaidCents || 0) ? "Refunded" : "Partially Refunded";

      transaction.update(orderRef, {
        refunds,
        auditHistory: auditLog,
        amountRefundedCents: totalRefundedCents,
        balanceDueCents: nextBalanceDueCents,
        paymentStatus: nextPaymentStatus,
        paymentUpdatedAt: new Date().toISOString()
      });
    } else if (stripeRefundStatus === "failed") {
      currentRefund.status = "failed";
      currentRefund.failedAt = new Date().toISOString();

      const auditLog = order.auditHistory || [];
      auditLog.push({
        action: "refund_failed",
        amountCents: actualRefundedAmountCents,
        stripeRefundId,
        timestamp: new Date().toISOString(),
        details: `Stripe refund failed.`
      });

      transaction.update(orderRef, {
        refunds,
        auditHistory: auditLog,
        paymentUpdatedAt: new Date().toISOString()
      });
    }
  });
}
