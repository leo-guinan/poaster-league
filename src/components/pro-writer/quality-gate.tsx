"use client";

import { useState, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { QualityCheck } from "@/lib/types/pro-writer";
import { cn } from "@/lib/utils";

interface QualityGateProps {
  checks: QualityCheck[];
}

const STATUS_LABELS = {
  pass: "✓",
  warning: "⚠️",
  excellent: "✓✓",
};

const CATEGORY_LABELS = {
  universal: "Universal",
  "intent-specific": "Intent-Specific",
  "relationship-aligned": "Relationship-Aligned",
};

export function QualityGate({ checks }: QualityGateProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group checks by category (must be before early return for hooks)
  const checksByCategory = useMemo(() => {
    const grouped: Record<string, QualityCheck[]> = {
      universal: [],
      "intent-specific": [],
      "relationship-aligned": [],
    };

    checks.forEach((check) => {
      const category = check.category || "universal";
      if (grouped[category]) {
        grouped[category].push(check);
      }
    });

    return grouped;
  }, [checks]);

  const warningCount = checks.filter((c) => c.status === "warning").length;

  if (checks.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Quality Gate</span>
            {warningCount > 0 && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {warningCount} warning{warningCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Pre-flight checks
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>
      <Separator />
      <CollapsibleContent className="pt-4">
        <div className="space-y-4">
          {Object.entries(checksByCategory).map(([category, categoryChecks]) => {
            if (categoryChecks.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
                </div>
                <div className="space-y-2">
                  {categoryChecks.map((check, index) => {
                    const statusLabel =
                      STATUS_LABELS[check.status as keyof typeof STATUS_LABELS];

                    return (
                      <TooltipProvider key={`${category}-${index}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                                "hover:bg-accent/50",
                                check.status === "warning"
                                  ? "border-yellow-500/20 bg-yellow-500/5"
                                  : check.status === "excellent"
                                    ? "border-green-500/20 bg-green-500/5"
                                    : "border-border"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm font-medium",
                                  check.status === "warning"
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : check.status === "excellent"
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-muted-foreground"
                                )}
                              >
                                {statusLabel}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">
                                  {check.signal}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs leading-relaxed">{check.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nothing auto-blocks publishing. These are mirrors, not walls.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

