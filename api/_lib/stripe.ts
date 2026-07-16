import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is missing");
  }

  // Use a reliable stable API version
  stripeClient = new Stripe(key, {
    apiVersion: "2023-10-16" as any,
  });

  return stripeClient;
}
