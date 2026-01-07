"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Search, Calendar, Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { trackEvent, trackPageView, FATHOM_EVENTS } from "@/lib/analytics";
import { ScoutSetup } from "@/components/scout/scout-setup";
import { ScoutReports } from "@/components/scout/scout-reports";

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

interface ScoutProfile {
  id: string;
  user_id: string;
  config: {
    intentShapes?: string[];
    domain?: string;
    relationshipTarget?: string;
    sensitivity?: "emerging" | "established";
  };
  active: boolean;
  created_at: string;
  updated_at: string;
}

function ScoutPageContent() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  // Track page view
  useEffect(() => {
    trackPageView("/scout");
    trackEvent(FATHOM_EVENTS.PAGE_VIEW_SCOUT);
  }, []);

  // Track successful subscription activation
  useEffect(() => {
    if (success === "true") {
      trackEvent(FATHOM_EVENTS.SCOUT_MODE_ACTIVATED);
    }
  }, [success]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchSubscription(), fetchProfile()]);
    setLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/scout/profile");
      const data = await response.json();
      setProfile(data.profile || null);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

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

  // Show setup if user has subscription but no profile, or if they explicitly want to see setup
  const shouldShowSetup = !profile && isActive || showSetup;
  const shouldShowReports = profile && isActive && !showSetup;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
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
              {shouldShowSetup
                ? "Program what you pay attention to"
                : "Discover writers matching your criteria"}
            </p>
          </div>
        </div>
        {shouldShowReports && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetup(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure Scout
          </Button>
        )}
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

      {/* Show setup flow if no subscription or no profile */}
      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle>Scout Mode</CardTitle>
            <CardDescription>
              Program what you pay attention to. Scout Mode scans the Pro Feed daily and surfaces people whose behavior matches your criteria—before it&apos;s obvious.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSubscribe} className="w-full sm:w-auto">
              <Search className="mr-2 h-4 w-4" />
              Activate Scout Mode - $29/month
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show setup if user has subscription but no profile */}
      {shouldShowSetup && isActive && (
        <ScoutSetup
          onComplete={() => {
            fetchProfile();
            setShowSetup(false);
          }}
        />
      )}

      {/* Show reports if profile exists */}
      {shouldShowReports && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscription Status</CardTitle>
                  <CardDescription>Manage your Scout Mode subscription</CardDescription>
                </div>
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold capitalize">{subscription?.status}</p>
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

              {subscription?.cancel_at_period_end && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <p className="text-sm font-medium">
                    Your subscription will cancel on {periodEnd?.toLocaleDateString()}. You&apos;ll continue to have access until then.
                  </p>
                </div>
              )}

              {isActive && !subscription?.cancel_at_period_end && (
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
            </CardContent>
          </Card>
          <ScoutReports profileId={profile?.id} />
        </>
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

