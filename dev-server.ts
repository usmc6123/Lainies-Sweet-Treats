import express from "express";
import { createServer as createViteServer } from "vite";

// Local imports of serverless handlers
import authHandler from "./api/auth.js";
import adminHandler from "./api/admin.js";
import publicHandler from "./api/public.js";
import stripeHandler from "./api/stripe.js";
import webhookHandler from "./api/stripe-webhook.js";

async function startServer() {
  const app = express();
  
  // Exempt stripe webhook from express.json parser to allow raw body signature verification
  app.use((req, res, next) => {
    if (req.path === "/api/stripe/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });


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
  app.all("/api/auth/change-password", adapt(authHandler));
  app.all("/api/user/login", adapt(authHandler));
  
  app.all("/api/settings", adapt(adminHandler));
  app.all("/api/coupons", adapt(adminHandler));
  app.all("/api/coupons/:id", adapt(adminHandler));
  app.all("/api/coupons/:id/toggle", adapt(adminHandler));

  app.all("/api/blocked-dates", adapt(adminHandler));
  app.all("/api/blocked-dates/:id", adapt(adminHandler));

  app.all("/api/public/menu", adapt(publicHandler));
  app.all("/api/public/order", adapt(publicHandler));
  app.all("/api/public/validate-coupon", adapt(publicHandler));

  app.all("/api/ingredients", adapt(adminHandler));
  app.all("/api/ingredients/:id", adapt(adminHandler));

  app.all("/api/expenses", adapt(adminHandler));
  app.all("/api/expenses/:id", adapt(adminHandler));

  app.all("/api/orders", adapt(adminHandler));
  app.all("/api/orders/:id", adapt(adminHandler));
  app.all("/api/orders/:id/status", adapt(adminHandler));

  app.all("/api/quotes", adapt(adminHandler));
  app.all("/api/quotes/:id", adapt(adminHandler));
  app.all("/api/quotes/:id/respond", adapt(adminHandler));

  app.all("/api/customers", adapt(adminHandler));
  app.all("/api/customers/:id", adapt(adminHandler));

  app.all("/api/analytics", adapt(adminHandler));

  app.all("/api/products", adapt(adminHandler));
  app.all("/api/products/:id", adapt(adminHandler));
  app.all("/api/upload", adapt(adminHandler));

  // Stripe payments endpoints
  app.all("/api/stripe/create-checkout-session", adapt(stripeHandler));
  app.all("/api/stripe/checkout-status", adapt(stripeHandler));
  app.all("/api/stripe/retry-payment", adapt(stripeHandler));
  app.all("/api/stripe/refund", adapt(stripeHandler));
  app.all("/api/stripe/test-connection", adapt(stripeHandler));
  app.all("/api/stripe/sync-order", adapt(stripeHandler));
  app.all("/api/stripe/webhook", adapt(webhookHandler));


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
