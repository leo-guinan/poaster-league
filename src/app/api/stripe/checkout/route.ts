import { NextResponse } from "next/server";
import { stripe, SCOUT_MODE_PRICE_ID } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST() {
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

    if (!SCOUT_MODE_PRICE_ID) {
      return NextResponse.json(
        { error: "Stripe price ID not configured" },
        { status: 500 }
      );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId: string;
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      // Get user email for Stripe customer
      const { data: userProfile } = await supabase
        .from("users")
        .select("handle, name")
        .eq("id", user.id)
        .single();

      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
          twitterHandle: userProfile?.handle || "",
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: SCOUT_MODE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/scout?success=true`,
      cancel_url: `${baseUrl}/scout?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    logger.debug("Stripe checkout session created", { sessionId: session.id });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("Error creating Stripe checkout session:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

