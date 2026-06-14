import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import adminModule from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { dbService } from "./src/server/db.js";
import loginHandler from "./api/user/login.js";

const admin = adminModule as any;
import { 
  Product, 
  Order, 
  OrderItem, 
  Quote, 
  Customer, 
  Ingredient, 
  Settings, 
  BlockedDate, 
  Expense 
} from "./src/types.js";

// ==========================================
// CENTRAL CONFIGS
// ==========================================
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET as string;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "elainiehoncoop@gmail.com";

// Store a hashed default password if none matches
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "password123", 10);

async function startServer() {
  // Real Firestore Admin Seeding at startup
  const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
  if (firebaseConfigEnv) {
    try {
      if (admin.apps.length === 0) {
        let credentials: any;
        if (firebaseConfigEnv.trim().startsWith("{")) {
          credentials = JSON.parse(firebaseConfigEnv);
        } else {
          credentials = { projectId: 'lainies-sweet-treats' };
        }
        if (credentials.private_key || credentials.client_email) {
          admin.initializeApp({
            credential: admin.credential.cert(credentials),
          });
        } else {
          admin.initializeApp({
            projectId: credentials.projectId || 'lainies-sweet-treats',
          });
        }
      }
      
      const realDb = getFirestore(admin.app());
      const adminEmail = "elainiehoncoop@gmail.com";
      const adminUid = "ek8gF35yuiWH7VXEzjUsTFdLANG3";
      
      const adminDocRef = realDb.collection("admins").doc(adminUid);
      const docSnap = await adminDocRef.get();
      if (!docSnap.exists) {
        const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "password123", 10);
        await adminDocRef.set({
          email: adminEmail,
          passwordHash: passwordHash,
          name: "Lainie Smith",
          displayName: "Lainie",
          isDisabled: false,
          role: "admin",
          createdAt: new Date().toISOString()
        });
        console.log("🚀 Pre-seeded default admin account in real Firestore admins collection.");
      }
    } catch (err) {
      console.error("⚠️ Failed to check/seed real Firestore admins collection on startup.", err);
    }
  }

  const app = express();
  app.use(express.json());

  // ==========================================
  // MIDDLEWARES
  // ==========================================
  function authenticateAdmin(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authentication token provided." });
    }
    const token = authHeader.split(" ")[1];
    if (!JWT_SECRET) {
      console.error("JWT_SECRET environment variable is missing.");
      return res.status(500).json({ error: "Access denied. Server is missing JWT_SECRET secret." });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== "admin" && decoded.isAdmin !== true) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }
      req.admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Your session has expired or is invalid. Please log in again." });
    }
  }

  // ==========================================
  // 1. ADMIN AUTHENTICATION
  // ==========================================
  // Mount custom Firestore/Local bridged login handler
  app.post("/api/auth/login", loginHandler);
  app.post("/api/user/login", loginHandler);

  // Verify token endpoint (for routing guards)
  app.get("/api/auth/verify", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ valid: false });
    const token = authHeader.split(" ")[1];
    if (!JWT_SECRET) {
      return res.status(500).json({ valid: false, error: "JWT_SECRET is missing." });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return res.json({ valid: true, admin: decoded });
    } catch {
      return res.status(401).json({ valid: false });
    }
  });

  // ==========================================
  // 2. PRODUCTS / CATALOG MANAGEMENT
  // ==========================================
  app.get("/api/products", async (req, res) => {
    try {
      const products = await dbService.list("products");
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/products", authenticateAdmin, async (req, res) => {
    try {
      const newProduct = await dbService.insert("products", req.body);
      res.status(201).json(newProduct);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/products/:id", authenticateAdmin, async (req, res) => {
    try {
      const updatedProduct = await dbService.update("products", req.params.id, req.body);
      res.json(updatedProduct);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/products/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("products", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3 & 4. ORDERS MANAGEMENT
  // ==========================================
  app.get("/api/orders", authenticateAdmin, async (req, res) => {
    try {
      const orders = await dbService.list("orders");
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", authenticateAdmin, async (req, res) => {
    try {
      const data = req.body;
      const orderNum = `LST-${1000 + (await dbService.list("orders")).length + 1}`;
      data.orderNumber = orderNum;
      data.orderDate = new Date().toISOString();
      const newOrder = await dbService.insert("orders", data);
      res.status(201).json(newOrder);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/orders/:id", authenticateAdmin, async (req, res) => {
    try {
      const updatedOrder = await dbService.update("orders", req.params.id, req.body);
      res.json(updatedOrder);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/orders/:id/status", authenticateAdmin, async (req, res) => {
    try {
      const { status, paymentStatus } = req.body;
      const updateData: any = {};
      if (status) updateData.status = status;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;

      const updated = await dbService.update("orders", req.params.id, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/orders/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("orders", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 5 & 6. CUSTOMER QUOTES
  // ==========================================
  app.get("/api/quotes", authenticateAdmin, async (req, res) => {
    try {
      const quotes = await dbService.list("quotes");
      res.json(quotes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    // Both admin or public submission (for request quote)
    try {
      const data = req.body;
      const quoteNum = `Q-${2000 + (await dbService.list("quotes")).length + 1}`;
      data.quoteNumber = quoteNum;
      data.createdAt = new Date().toISOString();
      if (!data.status) data.status = "Pending Review";
      const newQuote = await dbService.insert("quotes", data);
      res.status(201).json(newQuote);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/quotes/:id", authenticateAdmin, async (req, res) => {
    try {
      const updatedQuote = await dbService.update("quotes", req.params.id, req.body);
      res.json(updatedQuote);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/quotes/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("quotes", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public customer action to Accept or Decline a Quote
  app.post("/api/quotes/:id/respond", async (req, res) => {
    try {
      const { action } = req.body; // "accept" or "decline"
      const quote: Quote | null = await dbService.get("quotes", req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found." });
      }

      if (action === "accept") {
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
        const taxRate = settings.taxRate || 0.0825;
        const tax = parseFloat((subtotal * taxRate).toFixed(2));
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
          tax,
          deliveryFee: 0, // setup separately if needed
          total,
          orderDate: new Date().toISOString(),
          fulfillmentDate: quote.eventDate,
          type: "pickup",
          status: "Confirmed",
          paymentStatus: "Unpaid",
          notes: `Event: ${quote.eventType}.\nFlavor Preferences: ${quote.flavorPreferences}.\nDesign Ideas: ${quote.designIdeas}.\nServings: ${quote.servings}`
        };

        const createdOrder = await dbService.insert("orders", newOrder);
        return res.json({ status: "Accepted", order: createdOrder, quote: updatedQuote });
      } else if (action === "decline") {
        const updatedQuote = await dbService.update("quotes", quote.id, { status: "Declined" });
        return res.json({ status: "Declined", quote: updatedQuote });
      } else {
        return res.status(400).json({ error: "Invalid action. Must be accept or decline." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 7. CUSTOMERS DATABASE
  // ==========================================
  app.get("/api/customers", authenticateAdmin, async (req, res) => {
    try {
      const customers = await dbService.list("customers");
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/customers", authenticateAdmin, async (req, res) => {
    try {
      const customer = await dbService.insert("customers", req.body);
      res.status(201).json(customer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/customers/:id", authenticateAdmin, async (req, res) => {
    try {
      const customer = await dbService.update("customers", req.params.id, req.body);
      res.json(customer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/customers/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("customers", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 8. INGREDIENTS & EXPENSES
  // ==========================================
  app.get("/api/ingredients", authenticateAdmin, async (req, res) => {
    try {
      const ingredients = await dbService.list("ingredients");
      res.json(ingredients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ingredients", authenticateAdmin, async (req, res) => {
    try {
      const newIng = await dbService.insert("ingredients", req.body);
      res.status(201).json(newIng);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/ingredients/:id", authenticateAdmin, async (req, res) => {
    try {
      const updatedIng = await dbService.update("ingredients", req.params.id, req.body);
      res.json(updatedIng);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/ingredients/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("ingredients", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Expenses sub-routines
  app.get("/api/expenses", authenticateAdmin, async (req, res) => {
    try {
      const expenses = await dbService.list("expenses");
      res.json(expenses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/expenses", authenticateAdmin, async (req, res) => {
    try {
      const newExp = await dbService.insert("expenses", req.body);
      res.status(201).json(newExp);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/expenses/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("expenses", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 9. SETTINGS & BLOCKED DATES
  // ==========================================
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await dbService.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings", authenticateAdmin, async (req, res) => {
    try {
      const updated = await dbService.saveSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/blocked-dates", async (req, res) => {
    try {
      const dates = await dbService.list("blockedDates");
      res.json(dates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/blocked-dates", authenticateAdmin, async (req, res) => {
    try {
      const newDate = await dbService.insert("blockedDates", req.body);
      res.status(201).json(newDate);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/blocked-dates/:id", authenticateAdmin, async (req, res) => {
    try {
      await dbService.delete("blockedDates", req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 10 & 11. PUBLIC CONSUMER VIEWS (NO AUTH)
  // ==========================================
  app.get("/api/public/menu", async (req, res) => {
    try {
      const products = await dbService.list("products");
      // Map products to send to customers (hide cost ratios if needed, but simple menu lookup is sufficient)
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/public/order", async (req, res) => {
    try {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 12. ANALYTICS / REPORTING
  // ==========================================
  app.get("/api/analytics", authenticateAdmin, async (req, res) => {
    try {
      const orders: Order[] = await dbService.list("orders");
      const customers: Customer[] = await dbService.list("customers");
      const products: Product[] = await dbService.list("products");
      const ingredients: Ingredient[] = await dbService.list("ingredients");

      // Filter non-cancelled orders for accurate revenue analysis
      const validOrders = orders.filter(o => o.status !== "Cancelled");

      // 1. Total revenue
      const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

      // 2. Average Order Value
      const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

      // 3. Customer Return Rate
      const returnees = customers.filter(c => c.orderCount > 1).length;
      const returnRate = customers.length > 0 ? (returnees / customers.length) * 100 : 0;

      // 4. Busiest Days of Week (0 = Sunday, 1 = Monday ...)
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];
      const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      validOrders.forEach(o => {
        const d = new Date(o.fulfillmentDate);
        if (!isNaN(d.getTime())) {
          dayCounts[d.getDay()] = dayCounts[d.getDay()] + 1;
        }
      });

      const busiestDays = dayLabels.map((lbl, idx) => ({
        day: lbl,
        ordersCount: dayCounts[idx]
      }));

      // 5. Popular Products frequency
      const productFreq: { [key: string]: { name: string; qty: number; revenue: number } } = {};
      validOrders.forEach(o => {
        o.items.forEach(item => {
          if (!productFreq[item.productId]) {
            productFreq[item.productId] = { name: item.name, qty: 0, revenue: 0 };
          }
          productFreq[item.productId].qty += item.quantity;
          productFreq[item.productId].revenue += item.totalPrice;
        });
      });

      const popularProducts = Object.values(productFreq)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // 6. Revenue by Month
      const monthlyData: { [key: string]: number } = {};
      validOrders.forEach(o => {
        const d = new Date(o.fulfillmentDate);
        if (!isNaN(d.getTime())) {
          const monthYear = d.toLocaleString("default", { month: "short", year: "numeric" });
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + o.total;
        }
      });

      const revenueByMonth = Object.entries(monthlyData).map(([month, rev]) => ({
        month,
        revenue: parseFloat(rev.toFixed(2))
      }));

      // 7. Ingredient Margin analysis (Base price vs Ingredient Cost)
      const calculatedMargins = products.map(p => {
        let cost = 0;
        p.ingredients.forEach(link => {
          const ing = ingredients.find(i => i.id === link.ingredientId);
          if (ing) {
            cost += ing.costPerUnit * link.quantity;
          }
        });
        
        const profit = p.basePrice - cost;
        const marginPct = p.basePrice > 0 ? (profit / p.basePrice) * 100 : 0;
        
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          basePrice: p.basePrice,
          ingredientCost: parseFloat(cost.toFixed(2)),
          profit: parseFloat(profit.toFixed(2)),
          marginPercent: parseFloat(marginPct.toFixed(2))
        };
      });

      res.json({
        overview: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          returnRate: parseFloat(returnRate.toFixed(2)),
          activeOrders: validOrders.filter(o => o.status !== "Delivered/Picked Up").length,
          totalOrdersCount: validOrders.length,
          totalCustomersCount: customers.length
        },
        revenueByMonth,
        popularProducts,
        busiestDays,
        productCostMargins: calculatedMargins
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // VITE ON EXPRESS / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("🛠️ Vite running in development middleware mode.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("📦 Express serving production bundle from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🍰 Lainie's Bake Shop Server running on http://localhost:${PORT}`);
  });
}

startServer();
