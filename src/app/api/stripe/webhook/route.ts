import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import Stripe from "stripe";

// Type for Stripe subscription with required fields
type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
};

// Type for Stripe invoice with subscription
type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription: string | Stripe.Subscription | null;
};

// Disable body parsing, we need the raw body for Stripe signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

export async function POST(request: NextRequest) {
  // Get raw body as text for signature verification
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    logger.error("Missing Stripe signature");
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret || "");
  } catch (err) {
    logger.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Create Supabase client for admin operations
  const supabase = await createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabase);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, supabase);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice, supabase);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice, supabase);
        break;
      }

      default:
        logger.debug(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const userId = session.metadata?.userId;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || "";

  if (!userId || !subscriptionId) {
    logger.error("Missing userId or subscriptionId in checkout session");
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as StripeSubscriptionWithPeriod;

  // Upsert subscription in database
  await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: subscription.items.data[0]?.price.id || "",
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });

  logger.info("Checkout completed", { userId, subscriptionId });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // Find subscription by Stripe subscription ID
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!existing) {
    logger.warn("Subscription not found in database", { subscriptionId: subscription.id });
    return;
  }

  // Update subscription
  const subscriptionData = subscription as StripeSubscriptionWithPeriod;
  await supabase
    .from("subscriptions")
    .update({
      status: subscriptionData.status,
      current_period_start: new Date(subscriptionData.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscriptionData.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscriptionData.cancel_at_period_end,
      canceled_at: subscriptionData.canceled_at
        ? new Date(subscriptionData.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  logger.info("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  logger.info("Subscription deleted", { subscriptionId: subscription.id });
}

async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const invoiceData = invoice as StripeInvoiceWithSubscription;
  const subscriptionId = typeof invoiceData.subscription === "string" 
    ? invoiceData.subscription 
    : (invoiceData.subscription as Stripe.Subscription | null)?.id || "";
  if (!subscriptionId) return;

  // Update subscription status if needed
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpdated(subscription, supabase);

  logger.info("Payment succeeded", { invoiceId: invoice.id, subscriptionId });
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const invoiceData = invoice as StripeInvoiceWithSubscription;
  const subscriptionId = typeof invoiceData.subscription === "string" 
    ? invoiceData.subscription 
    : (invoiceData.subscription as Stripe.Subscription | null)?.id || "";
  if (!subscriptionId) return;

  // Update subscription status
  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  logger.warn("Payment failed", { invoiceId: invoice.id, subscriptionId });
}

