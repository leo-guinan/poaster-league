"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, Layers, MessageSquare, Users, GraduationCap, Code } from "lucide-react";
import { ScoutConfig, RelationshipTarget, ScoutIntentType } from "@/lib/types/user";

interface ScoutSetupProps {
  onComplete?: () => void;
}

const INTENT_OPTIONS: Array<{
  id: ScoutIntentType;
  label: string;
  description: string;
  icon: typeof Lightbulb;
}> = [
  {
    id: "propose",
    label: "Proposing",
    description: "Offering specific ideas or solutions",
    icon: Lightbulb,
  },
  {
    id: "synthesize",
    label: "Synthesizing",
    description: "Connecting multiple ideas into new frameworks",
    icon: Layers,
  },
  {
    id: "critique",
    label: "Critiquing",
    description: "Analyzing and improving existing work",
    icon: MessageSquare,
  },
  {
    id: "seek-collaborators",
    label: "Seeking collaborators",
    description: "Looking for partnership or joint work",
    icon: Users,
  },
  {
    id: "teach",
    label: "Teaching / explaining",
    description: "Sharing knowledge and guidance",
    icon: GraduationCap,
  },
  {
    id: "build-in-public",
    label: "Building in public",
    description: "Documenting work and progress openly",
    icon: Code,
  },
];

const RELATIONSHIP_OPTIONS: Array<{
  id: RelationshipTarget;
  label: string;
  description: string;
}> = [
  {
    id: "collaborator",
    label: "Collaborator",
    description: "Someone to work with on projects",
  },
  {
    id: "hire",
    label: "Hire / recruit",
    description: "Potential team member or employee",
  },
  {
    id: "mentor",
    label: "Mentor",
    description: "Someone to learn from",
  },
  {
    id: "peer",
    label: "Peer",
    description: "Equal-level connection for mutual growth",
  },
  {
    id: "investment",
    label: "Investment / support",
    description: "Someone to invest in or support",
  },
  {
    id: "track",
    label: "Just track quietly",
    description: "Monitor without specific relationship goal",
  },
];

export function ScoutSetup({ onComplete: _onComplete }: ScoutSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    monthlyEstimate: number;
    strongMatches: number;
    mediumMatches: number;
  } | null>(null);

  const [config, setConfig] = useState<Partial<ScoutConfig>>({
    intentShapes: [],
    domain: "",
    relationshipTarget: undefined,
    sensitivity: "emerging",
  });

  // Step 1: Intent Shapes
  const handleIntentToggle = (intentId: ScoutIntentType) => {
    setConfig((prev) => {
      const current = prev.intentShapes || [];
      const maxSelections = 3;

      if (current.includes(intentId)) {
        return {
          ...prev,
          intentShapes: current.filter((id) => id !== intentId),
        };
      }

      if (current.length >= maxSelections) {
        return prev;
      }

      return {
        ...prev,
        intentShapes: [...current, intentId],
      };
    });
  };

  // Step 3: Relationship Target
  const handleRelationshipSelect = (target: RelationshipTarget) => {
    setConfig((prev) => ({
      ...prev,
      relationshipTarget: target,
    }));
  };

  // Step 4: Sensitivity
  const handleSensitivityChange = (value: "emerging" | "established") => {
    setConfig((prev) => ({
      ...prev,
      sensitivity: value,
    }));
  };

  // Step 5: Preview Coverage
  const handlePreview = async () => {
    if (!config.intentShapes || config.intentShapes.length === 0) {
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await fetch("/api/scout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    // Auto-preview when we reach step 5
    if (step === 5 && config.intentShapes && config.intentShapes.length > 0) {
      handlePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step 6: Activate
  const handleActivate = async () => {
    if (!config.intentShapes || config.intentShapes.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/scout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to create scout");
        setLoading(false);
        return;
      }

      // Redirect to Stripe checkout
      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json();
        alert(error.error || "Failed to start checkout");
        setLoading(false);
        return;
      }

      const { url } = await checkoutResponse.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error activating scout:", error);
      alert("Failed to activate scout. Please try again.");
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return config.intentShapes && config.intentShapes.length > 0;
      case 2:
        return true; // Domain is optional
      case 3:
        return !!config.relationshipTarget;
      case 4:
        return true; // Always has a default
      case 5:
        return true; // Preview is automatic
      case 6:
        return true;
      default:
        return false;
    }
  };

  const getSensitivityPosition = () => {
    // Default is 30% toward emerging (70% toward established in slider)
    // We'll show it as a slider from 0-100 where 0 = emerging, 100 = established
    return config.sensitivity === "emerging" ? 30 : 70;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center space-x-2">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            className={`h-2 w-2 rounded-full ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Intent Shapes */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose the Intent Shape</CardTitle>
            <CardDescription>
              Select 1-3 intent modes that match what you&apos;re looking for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {INTENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected =
                  config.intentShapes?.includes(option.id) || false;
                const isDisabled =
                  !isSelected &&
                  (config.intentShapes?.length || 0) >= 3;

                return (
                  <div
                    key={option.id}
                    onClick={() => !isDisabled && handleIntentToggle(option.id)}
                    className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded border-2 mt-0.5">
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Label className="cursor-pointer font-medium">
                          {option.label}
                        </Label>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {config.intentShapes && config.intentShapes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.intentShapes.map((id) => {
                  const option = INTENT_OPTIONS.find((o) => o.id === id);
                  return (
                    <Badge key={id} variant="secondary">
                      {option?.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Domain */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Define the Domain</CardTitle>
            <CardDescription>
              Optional: Constrain where intent matters (e.g., &quot;AI safety tooling&quot;, &quot;Local-first software&quot;)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="domain">Domain (optional)</Label>
              <Textarea
                id="domain"
                placeholder="AI safety tooling, Local-first software, Creator economics..."
                value={config.domain || ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, domain: e.target.value }))
                }
                className="mt-2"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Relationship Target */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Relationship Target</CardTitle>
            <CardDescription>
              If this scout succeeds, what kind of relationship would you want?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RELATIONSHIP_OPTIONS.map((option) => {
              const isSelected = config.relationshipTarget === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => handleRelationshipSelect(option.id)}
                  className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded border-2 mt-0.5">
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <Label className="cursor-pointer font-medium">
                      {option.label}
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Sensitivity */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Sensitivity</CardTitle>
            <CardDescription>
              Adjust how early or established the signals should be
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Emerging</Label>
                  <p className="text-sm text-muted-foreground">
                    Weak signal, low exposure, early trajectories
                  </p>
                </div>
                <div className="text-right">
                  <Label>Established</Label>
                  <p className="text-sm text-muted-foreground">
                    Consistent output, clearer patterns, higher confidence
                  </p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={getSensitivityPosition()}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    handleSensitivityChange(value < 50 ? "emerging" : "established");
                  }}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary"
                />
                <div className="absolute top-6 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                  <span>Early signals</span>
                  <span>Clear patterns</span>
                </div>
              </div>
              <div className="text-center">
                <Badge variant="secondary">
                  {config.sensitivity === "emerging"
                    ? "Emerging focus"
                    : "Established focus"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Preview */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Coverage</CardTitle>
            <CardDescription>
              Based on the last 30 days, here&apos;s what to expect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-6 text-center">
                  <div className="text-3xl font-bold">
                    {previewData.monthlyEstimate}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    candidates per month
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Strong matches</span>
                    <span className="font-medium">
                      {previewData.strongMatches}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Medium matches</span>
                    <span className="font-medium">
                      {previewData.mediumMatches}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                Unable to generate preview
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Activate */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Activate Scout</CardTitle>
            <CardDescription>Start your Scout Mode subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-6">
              <div className="text-center">
                <div className="text-4xl font-bold">$29</div>
                <div className="text-muted-foreground">per month</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>1 active scout</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Daily scan</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Weekly report</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
            <Button
              onClick={handleActivate}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate Scout"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Back
        </Button>
        {step < 6 && (
          <Button
            onClick={() => setStep((s) => Math.min(6, s + 1))}
            disabled={!canProceed()}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

