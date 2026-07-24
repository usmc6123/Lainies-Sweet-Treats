import { dbService } from '../src/server/db.js';
import { setCorsHeaders, parseRoute } from './_lib/helper.js';
import { Order, BlockedDate, Quote } from '../src/types.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const { action, id, subAction } = parseRoute(req);

    if (action === "menu" && req.method === "GET") {
      const products = await dbService.list("products");
      const visibleProducts = products.filter((p: any) => p.isVisible !== false);
      return res.status(200).json(visibleProducts);
    }

    if (action === "validate-coupon" && req.method === "POST") {
      const { code, subtotal } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Coupon code is required." });
      }

      const cleanCode = code.toUpperCase().trim();
      const coupons = await dbService.list("coupons");
      const coupon = coupons.find(c => c.code === cleanCode);

      if (!coupon) {
        return res.status(400).json({ error: "Invalid coupon code." });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ error: "This coupon is no longer active." });
      }

      if (coupon.expirationDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (today > coupon.expirationDate) {
          return res.status(400).json({ error: "This coupon has expired." });
        }
      }

      if (coupon.maxUses !== undefined && coupon.maxUses !== null) {
        const usageCount = coupon.usageCount || 0;
        if (usageCount >= coupon.maxUses) {
          return res.status(400).json({ error: "This coupon is fully claimed." });
        }
      }

      if (coupon.minOrderAmount) {
        if (subtotal < coupon.minOrderAmount) {
          return res.status(400).json({ error: `This coupon requires a minimum order subtotal of $${coupon.minOrderAmount.toFixed(2)}.` });
        }
      }

      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
        discountAmount = parseFloat(((subtotal * coupon.discountValue) / 100).toFixed(2));
      } else {
        discountAmount = Math.min(coupon.discountValue, subtotal);
      }

      return res.status(200).json({
        success: true,
        coupon,
        discountAmount
      });
    }

    if (action === "order" && req.method === "POST") {
      const orderData: Partial<Order> = req.body;
      const { fulfillmentDate, customerEmail, customerName, customerPhone, total } = orderData;

      if (!fulfillmentDate || !customerEmail || !customerName || !customerPhone || !total) {
        return res.status(400).json({ error: "Missing required order checkout information." });
      }

      // Check lead time validation
      const settings = await dbService.getSettings();
      const minNotice = settings.leadTimeDays || 3;
      const proposedDate = new Date(fulfillmentDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + minNotice);
      
      // Zero out hours for clean comparison
      proposedDate.setHours(0,0,0,0);
      minDate.setHours(0,0,0,0);

      if (proposedDate < minDate) {
        return res.status(400).json({ 
          error: `Minimum ordering lead time is ${minNotice} days. First available fulfillment date is ${minDate.toISOString().slice(0, 10)}.` 
        });
      }

      // 1. Check Blocked Dates
      const blockedDates: BlockedDate[] = await dbService.list("blockedDates");
      const isBlocked = blockedDates.some(b => b.date === fulfillmentDate);
      if (isBlocked) {
        return res.status(400).json({ error: "Sorry, this date is unavailable for custom baking. Please choose another date!" });
      }

      // 2. Daily Capacity Check (Max 10 orders per day)
      const allOrders: Order[] = await dbService.list("orders");
      const activeOrdersOnDay = allOrders.filter(
        o => o.fulfillmentDate === fulfillmentDate && o.status !== "Cancelled"
      );

      if (activeOrdersOnDay.length >= 10) {
        return res.status(400).json({ 
          error: "Baking capacity limit reached (maximum 10 orders) for this date. Lainie is fully booked! Please select another date for your sweet treats." 
        });
      }

      // Create or update Customer in CRM Database
      const customers = await dbService.list("customers");
      const existingCustomer = customers.find(c => c.email.toLowerCase() === customerEmail.toLowerCase());
      
      let customerId: string;
      const amountSpent = parseFloat(total.toString());

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await dbService.update("customers", customerId, {
          orderCount: existingCustomer.orderCount + 1,
          totalSpent: parseFloat((existingCustomer.totalSpent + amountSpent).toFixed(2)),
          lastOrderDate: fulfillmentDate
        });
      } else {
        const newCust = await dbService.insert("customers", {
          name: customerName,
          email: customerEmail.toLowerCase(),
          phone: customerPhone,
          orderCount: 1,
          totalSpent: amountSpent,
          lastOrderDate: fulfillmentDate,
          isVIP: false,
          notes: "Auto-created on high-quality customer order checkout."
        });
        customerId = newCust.id;
      }

      // Generate order details
      const orderCount = allOrders.length;
      const orderNum = `LST-${1000 + orderCount + 1}`;
      
      orderData.orderNumber = orderNum;
      orderData.customerId = customerId;
      orderData.orderDate = new Date().toISOString();
      orderData.status = "Pending";
      orderData.paymentStatus = "Unpaid";

      const savedOrder = await dbService.insert("orders", orderData);

      // Increment coupon usage count if couponCode is used
      if (orderData.couponCode) {
        try {
          const cleanCouponCode = orderData.couponCode.toUpperCase().trim();
          const coupons = await dbService.list("coupons");
          const couponToInc = coupons.find(c => c.code === cleanCouponCode);
          if (couponToInc) {
            await dbService.update("coupons", couponToInc.id, {
              usageCount: (couponToInc.usageCount || 0) + 1
            });
          }
        } catch (cErr) {
          console.error("Failed to increment coupon utilization:", cErr);
        }
      }

      return res.status(201).json(savedOrder);
    }

    // Public quotes endpoints
    if (action === "quotes" && req.method === "POST") {
      if (id && subAction === "respond") {
        const { action: decision } = req.body; // "accept" or "decline"
        const quote: Quote | null = await dbService.get("quotes", id);
        if (!quote) {
          return res.status(404).json({ error: "Quote not found." });
        }

        if (decision === "accept") {
          // Mark Quote as Accepted
          const updatedQuote = await dbService.update("quotes", quote.id, { status: "Accepted" });
          
          // Form a corresponding Order
          const orders = await dbService.list("orders");
          const orderNum = `LST-${1000 + orders.length + 1}`;
          const settings = await dbService.getSettings();
          
          // Find or Create Customer
          const customers = await dbService.list("customers");
          let customer = customers.find((c: any) => c.email.toLowerCase() === quote.contactEmail.toLowerCase());
          let customerId: string;
          
          const subtotal = quote.priceProposal || 0;
          const products = await dbService.list("products");
          const proposedItems = quote.proposedItems || [];
          let taxableSubtotal = 0;
          if (proposedItems.length > 0) {
            for (const item of proposedItems) {
              const prod = products.find((p: any) => p.id === item.productId);
              let isTaxable = false;
              if (prod) {
                if (typeof prod.isTaxable === "boolean") isTaxable = prod.isTaxable;
                else if (typeof prod.taxable === "boolean") isTaxable = prod.taxable;
                else {
                  const cat = (prod.category || "").toLowerCase();
                  const pName = (prod.name || "").toLowerCase();
                  isTaxable = cat === "mini cakes" || pName === "mini cakes" || pName.includes("mini cake");
                }
              } else {
                const iName = (item.name || "").toLowerCase();
                isTaxable = iName.includes("mini cake");
              }
              if (isTaxable) {
                taxableSubtotal += item.totalPrice || (item.unitPrice * item.quantity) || 0;
              }
            }
          }
          const taxRate = settings.taxRate || 0.0825;
          const tax = parseFloat((taxableSubtotal * taxRate).toFixed(2));
          const total = parseFloat((subtotal + tax).toFixed(2));

          if (!customer) {
            const newCust = await dbService.insert("customers", {
              name: quote.contactName,
              email: quote.contactEmail.toLowerCase(),
              phone: quote.contactPhone,
              totalSpent: total,
              orderCount: 1,
              lastOrderDate: quote.eventDate,
              isVIP: false,
              notes: "Created automatically from accepted wedding/custom quote request."
            });
            customerId = newCust.id;
          } else {
            customerId = customer.id;
            await dbService.update("customers", customer.id, {
              totalSpent: parseFloat((customer.totalSpent + total).toFixed(2)),
              orderCount: customer.orderCount + 1,
              lastOrderDate: quote.eventDate
            });
          }

          const newOrder: Partial<Order> = {
            orderNumber: orderNum,
            customerId,
            customerName: quote.contactName,
            customerEmail: quote.contactEmail,
            customerPhone: quote.contactPhone,
            items: quote.proposedItems || [
              {
                productId: "custom-dessert",
                name: `Custom Custom Cake: ${quote.eventType}`,
                quantity: 1,
                unitPrice: quote.priceProposal || 0,
                totalPrice: quote.priceProposal || 0,
                notes: quote.designIdeas
              } as any
            ],
            subtotal,
            taxableSubtotal,
            tax,
            deliveryFee: 0,
            total,
            subtotalCents: Math.round(subtotal * 100),
            taxableSubtotalCents: Math.round(taxableSubtotal * 100),
            taxAmountCents: Math.round(tax * 100),
            totalAmountCents: Math.round(total * 100),
            orderDate: new Date().toISOString(),
            fulfillmentDate: quote.eventDate,
            type: "pickup",
            status: "Confirmed",
            paymentStatus: "Unpaid",
            notes: `Event: ${quote.eventType}.\nFlavor Preferences: ${quote.flavorPreferences}.\nDesign Ideas: ${quote.designIdeas}.\nServings: ${quote.servings}`
          };

          const createdOrder = await dbService.insert("orders", newOrder);
          return res.status(200).json({ status: "Accepted", order: createdOrder, quote: updatedQuote });
        } else if (decision === "decline") {
          const updatedQuote = await dbService.update("quotes", quote.id, { status: "Declined" });
          return res.status(200).json({ status: "Declined", quote: updatedQuote });
        } else {
          return res.status(400).json({ error: "Invalid action. Must be accept or decline." });
        }
      }

      // PUBLIC: Request Quote (POST /api/quotes)
      const data = req.body;
      const quotes = await dbService.list("quotes");
      const quoteNum = `Q-${2000 + quotes.length + 1}`;
      data.quoteNumber = quoteNum;
      data.createdAt = new Date().toISOString();
      if (!data.status) data.status = "Pending Review";
      const newQuote = await dbService.insert("quotes", data);
      return res.status(201).json(newQuote);
    }

    return res.status(404).json({ error: "Subpath not found or method not supported" });
  } catch (error: any) {
    console.error('Public Storefront API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
