import { dbService } from '../src/server/db.js';
import { setCorsHeaders } from './_lib/helper.js';
import { Order, BlockedDate } from '../src/types.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const action = parts[2]; // "menu" or "order"

    if (action === "menu" && req.method === "GET") {
      const products = await dbService.list("products");
      return res.status(200).json(products);
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
      return res.status(201).json(savedOrder);
    }

    return res.status(404).json({ error: "Subpath not found or method not supported" });
  } catch (error: any) {
    console.error('Public Storefront API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
