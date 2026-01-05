import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import Stripe from "stripe";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get subscription from database
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      logger.error("Error fetching subscription:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // Get latest subscription details from Stripe
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      // Type assertion for subscription with period fields
      type SubscriptionWithPeriod = Stripe.Subscription & {
        current_period_end: number;
        cancel_at_period_end: boolean;
      };
      const subscriptionData = stripeSubscription as unknown as SubscriptionWithPeriod;

      return NextResponse.json({
        subscription: {
          ...subscription,
          // Include Stripe-specific details
          stripeSubscription: {
            status: subscriptionData.status,
            current_period_end: new Date(subscriptionData.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscriptionData.cancel_at_period_end,
          },
        },
      });
    } catch (stripeError) {
      logger.error("Error fetching Stripe subscription:", stripeError);
      // Return database subscription even if Stripe fetch fails
      return NextResponse.json({ subscription });
    }
  } catch (error) {
    logger.error("Error in subscription route:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Cancel subscription at period end
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    logger.info("Subscription cancellation scheduled", {
      userId: user.id,
      subscriptionId: subscription.stripe_subscription_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error canceling subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

