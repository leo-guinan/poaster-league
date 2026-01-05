import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Scout Mode subscription price ID
// This should be set in your environment variables
// You'll create this in Stripe Dashboard -> Products -> Create Product
export const SCOUT_MODE_PRICE_ID = process.env.STRIPE_SCOUT_MODE_PRICE_ID || "";

if (!SCOUT_MODE_PRICE_ID) {
  console.warn("STRIPE_SCOUT_MODE_PRICE_ID is not set. Scout Mode subscriptions will not work.");
}

