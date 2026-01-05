"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Search, Calendar } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  stripeSubscription?: {
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
  };
}

function ScoutPageContent() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch("/api/stripe/subscription");
      const data = await response.json();
      setSubscription(data.subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll continue to have access until the end of your billing period.")) {
      return;
    }

    setCanceling(true);
    try {
      const response = await fetch("/api/stripe/subscription", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to cancel subscription");
        return;
      }

      // Refresh subscription status
      await fetchSubscription();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setCanceling(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to start checkout");
        return;
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/" className="flex items-center">
          <NextImage
            src="/logo.svg"
            alt="Poaster League"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
        </Link>
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Scout Mode</h1>
          <p className="text-muted-foreground">
            Discover writers matching your criteria
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium">Subscription activated successfully!</p>
          </div>
        </div>
      )}

      {canceled && (
        <div className="mb-6 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium">Checkout was canceled</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>
                Manage your Scout Mode subscription
              </CardDescription>
            </div>
            {isActive && (
              <Badge variant="default" className="bg-green-600">
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!subscription ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You don&apos;t have an active subscription. Subscribe to Scout Mode to start discovering writers.
              </p>
              <Button onClick={handleSubscribe} className="w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" />
                Subscribe to Scout Mode - $29/month
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold capitalize">{subscription.status}</p>
                </div>
                {periodEnd && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Next Billing Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <p className="text-lg font-semibold">
                        {periodEnd.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {subscription.cancel_at_period_end && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <p className="text-sm font-medium">
                    Your subscription will cancel on {periodEnd?.toLocaleDateString()}. You&apos;ll continue to have access until then.
                  </p>
                </div>
              )}

              {isActive && !subscription.cancel_at_period_end && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={canceling}
                >
                  {canceling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Canceling...
                    </>
                  ) : (
                    "Cancel Subscription"
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isActive && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Scout Configuration</CardTitle>
            <CardDescription>
              Configure your scout criteria (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Scout configuration UI will be available here soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ScoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ScoutPageContent />
    </Suspense>
  );
}

