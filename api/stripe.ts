import { dbService, getDb } from "../src/server/db.js";
import { setCorsHeaders, authenticateAdmin } from "./_lib/helper.js";
import { getStripe } from "./_lib/stripe.js";
import { calculateAuthoritativePricing, getNextOrderNumber, toCents, fromCents, roundCurrency } from "./_lib/order-pricing.js";
import { Order, BlockedDate } from "../src/types.js";

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const action = parts[2]; // e.g. "create-checkout-session"

    // Retrieve environment configuration
    const stripeCurrency = process.env.STRIPE_CURRENCY || "usd";
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

      // Daily Capacity Check (Max 10 orders per day, counting active Paid, Unpaid, and active unpaid Checkout Created sessions)
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
        // Concatenate description details
        const descParts: string[] = [];
        if (item.size) descParts.push(`Size: ${item.size}`);
        if (item.selectedCakeFlavors && item.selectedCakeFlavors.length > 0) {
          descParts.push(`Cake Flavor: ${item.selectedCakeFlavors.join(", ")}`);
        }
        if (item.selectedFrostings && item.selectedFrostings.length > 0) {
          descParts.push(`Frosting: ${item.selectedFrostings.join(", ")}`);
        } else if (item.flavor) {
          descParts.push(`Frosting: ${item.flavor}`);
        }
        if (item.selectedDrizzles && item.selectedDrizzles.length > 0) {
          descParts.push(`Drizzle: ${item.selectedDrizzles.join(", ")}`);
        }
        if (item.selectedToppings && item.selectedToppings.length > 0) {
          descParts.push(`Toppings: ${item.selectedToppings.join(", ")}`);
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

      // Prepare discounts/coupons via Stripe Ephemeral Coupon to guarantee exact amount matching
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

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
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

      // Construct and save the pending Order Document in Firestore
      const newOrder: Order = {
        id: orderId,
        orderNumber,
        customerId: "", // Resolved after verification of payment
        customerName,
        customerEmail: customerEmail.toLowerCase(),
        customerPhone,
        items: pricing.items as any,
        subtotal: roundCurrency(fromCents(pricing.subtotalCents)),
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
        currency: "usd",
        subtotalCents: pricing.subtotalCents,
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
        checkoutExpiresAt: new Date(expiresAtMs).toISOString()
      };

      await dbService.insert("orders", newOrder);

      return res.status(200).json({
        checkoutUrl: session.url,
        orderId,
        orderNumber,
        expiresAt: new Date(expiresAtMs).toISOString()
      });
    }

    // Action 2: Check status of Stripe checkout session
    if (action === "checkout-status" && req.method === "GET") {
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return res.status(400).json({ error: "session_id query parameter is required." });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const orderId = session.client_reference_id;

      if (!orderId) {
        return res.status(404).json({ error: "Order details not linked on session." });
      }

      const order: Order | null = await dbService.get("orders", orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      // Best practice fallback: if Stripe payment is successful, but webhook didn't arrive yet,
      // run verification synchronously here so frontend succeeds instantly!
      if (session.payment_status === "paid" && order.paymentStatus !== "Paid") {
        console.log(`[Status Sync] Session paid, running inline validation for order: ${orderId}`);
        // Run full payment confirmation logic exactly once
        await confirmSuccessfulOrderPayment(orderId, session.id, session.payment_intent as string);
        const updatedOrder = await dbService.get("orders", orderId);
        return res.status(200).json(updatedOrder);
      }

      return res.status(200).json(order);
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

      // Build pricing payload from order snapshot items
      const pricing = await calculateAuthoritativePricing(
        order.items as any,
        order.couponCode,
        order.tipAmountCents ? "custom" : "none",
        order.tipAmountCents ? fromCents(order.tipAmountCents) : 0,
        order.type
      );

      // Check for price changes
      const totalChanged = pricing.totalAmountCents !== order.totalAmountCents;

      // Update Checkout session
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

      const session = await stripe.checkout.sessions.create({
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
        success_url: `${appBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/?payment=cancelled&orderId=${orderId}`,
        expires_at: Math.floor(expiresAtMs / 1000)
      });

      // Update Order document in Firestore
      const updatedFields: Partial<Order> = {
        stripeCheckoutSessionId: session.id,
        checkoutAttemptId,
        checkoutCreatedAt: new Date().toISOString(),
        checkoutExpiresAt: new Date(expiresAtMs).toISOString(),
        paymentStatus: "Checkout Created"
      };

      if (totalChanged) {
        updatedFields.subtotal = roundCurrency(fromCents(pricing.subtotalCents));
        updatedFields.tax = roundCurrency(fromCents(pricing.taxAmountCents));
        updatedFields.deliveryFee = roundCurrency(fromCents(pricing.deliveryFeeCents));
        updatedFields.total = roundCurrency(fromCents(pricing.totalAmountCents));
        updatedFields.discountAmount = pricing.discountAmountCents > 0 ? roundCurrency(fromCents(pricing.discountAmountCents)) : undefined;
        updatedFields.tipAmount = pricing.tipAmountCents > 0 ? roundCurrency(fromCents(pricing.tipAmountCents)) : undefined;

        updatedFields.subtotalCents = pricing.subtotalCents;
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
      // Refund using idempotency key
      const refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: refundAmountCents,
        metadata: {
          orderId,
          orderNumber: order.orderNumber
        }
      }, {
        idempotencyKey: `ref-${orderId}-${refundAmountCents}-${Date.now()}`
      });

      const nextRefundedCents = (order.amountRefundedCents || 0) + refundAmountCents;
      const nextBalanceDueCents = Math.max(0, (order.amountPaidCents || 0) - nextRefundedCents);
      const nextPaymentStatus = nextRefundedCents >= (order.amountPaidCents || 0) ? "Refunded" : "Partially Refunded";

      // Also adjust customer totalSpent down proportionally!
      if (order.customerId) {
        const customer = await dbService.get("customers", order.customerId);
        if (customer) {
          const refundAmountDollar = fromCents(refundAmountCents);
          await dbService.update("customers", order.customerId, {
            totalSpent: Math.max(0, roundCurrency(customer.totalSpent - refundAmountDollar))
          });
        }
      }

      const updatedOrder = await dbService.update("orders", orderId, {
        amountRefundedCents: nextRefundedCents,
        balanceDueCents: nextBalanceDueCents,
        paymentStatus: nextPaymentStatus,
        refundedAt: new Date().toISOString(),
        paymentUpdatedAt: new Date().toISOString(),
        // backwards compatibility dollar fields
        total: roundCurrency(fromCents(order.totalAmountCents || 0) - fromCents(nextRefundedCents))
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
        await confirmSuccessfulOrderPayment(orderId, session.id, session.payment_intent as string);
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
 * Shared order confirmation and customer CRM accounting routine.
 * Executes exactly once safely (idempotent).
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

    // Guard duplicate executions
    if (order.paymentStatus === "Paid" || order.couponUsageApplied) {
      console.log(`[Idempotency Guard] Order ${orderId} already successfully processed.`);
      return;
    }

    // 1. Mark Payment Status
    const totalCents = order.totalAmountCents || toCents(order.total || 0);
    const updatePayload: any = {
      paymentStatus: "Paid",
      status: "Confirmed",
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId || "",
      amountPaidCents: totalCents,
      balanceDueCents: 0,
      paidAt: new Date().toISOString(),
      paymentUpdatedAt: new Date().toISOString(),
    };

    // 2. Customer CRM update (accounting only after verified payment!)
    let customerId = order.customerId;
    const amountSpent = order.total; // full successful dollar amount

    const customersSnap = await db.collection("customers").get();
    const customers = customersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const existingCustomer = customers.find((c: any) => c.email.toLowerCase() === order.customerEmail.toLowerCase());

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const customerRef = db.collection("customers").doc(customerId);
      transaction.update(customerRef, {
        orderCount: existingCustomer.orderCount + 1,
        totalSpent: parseFloat((existingCustomer.totalSpent + amountSpent).toFixed(2)),
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

    // 3. Increment Coupon utilization count exactly once
    if (order.couponCode) {
      const cleanCouponCode = order.couponCode.toUpperCase().trim();
      const couponsSnap = await db.collection("coupons").get();
      const coupons = couponsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      const couponToInc = coupons.find((c: any) => c.code === cleanCouponCode);
      if (couponToInc) {
        const couponRef = db.collection("coupons").doc(couponToInc.id);
        transaction.update(couponRef, {
          usageCount: (couponToInc.usageCount || 0) + 1
        });
        updatePayload.couponUsageApplied = true;
      }
    }

    // 4. Record dynamic order confirmation flag
    updatePayload.confirmationApplied = true;

    transaction.update(orderRef, updatePayload);
    console.log(`🍰 Payment confirmed successfully for Order: ${order.orderNumber} (Id: ${orderId})`);
  });
}
