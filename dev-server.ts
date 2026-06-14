import express from "express";
import { createServer as createViteServer } from "vite";

// Local imports of serverless handlers
import authHandler from "./api/auth.js";
import settingsHandler from "./api/settings.js";
import blockedDatesHandler from "./api/blocked-dates.js";
import publicHandler from "./api/public.js";
import ingredientsHandler from "./api/ingredients.js";
import expensesHandler from "./api/expenses.js";
import ordersHandler from "./api/orders.js";
import quotesHandler from "./api/quotes.js";
import customersHandler from "./api/customers.js";
import analyticsHandler from "./api/analytics.js";
import productsHandler from "./api/products.js";
import uploadHandler from "./api/upload.js";

async function startServer() {
  const app = express();
  app.use(express.json());

  // Set up a small adapter to pass the request/response to our Vercel handlers
  const adapt = (handler: any) => async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      console.error("Dev adapter error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  };

  // Route API paths explicitly to Vercel handlers
  app.all("/api/auth/login", adapt(authHandler));
  app.all("/api/auth/verify", adapt(authHandler));
  app.all("/api/user/login", adapt(authHandler));
  
  app.all("/api/settings", adapt(settingsHandler));

  app.all("/api/blocked-dates", adapt(blockedDatesHandler));
  app.all("/api/blocked-dates/:id", adapt(blockedDatesHandler));

  app.all("/api/public/menu", adapt(publicHandler));
  app.all("/api/public/order", adapt(publicHandler));

  app.all("/api/ingredients", adapt(ingredientsHandler));
  app.all("/api/ingredients/:id", adapt(ingredientsHandler));

  app.all("/api/expenses", adapt(expensesHandler));
  app.all("/api/expenses/:id", adapt(expensesHandler));

  app.all("/api/orders", adapt(ordersHandler));
  app.all("/api/orders/:id", adapt(ordersHandler));
  app.all("/api/orders/:id/status", adapt(ordersHandler));

  app.all("/api/quotes", adapt(quotesHandler));
  app.all("/api/quotes/:id", adapt(quotesHandler));
  app.all("/api/quotes/:id/respond", adapt(quotesHandler));

  app.all("/api/customers", adapt(customersHandler));
  app.all("/api/customers/:id", adapt(customersHandler));

  app.all("/api/analytics", adapt(analyticsHandler));

  app.all("/api/products", adapt(productsHandler));
  app.all("/api/products/:id", adapt(productsHandler));
  app.all("/api/upload", adapt(uploadHandler));

  // Vite middleware for development UI
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(3000, "0.0.0.0", () => {
    console.log("🍰 Local Dev Sandbox Server running on http://localhost:3000");
  });
}

startServer();
