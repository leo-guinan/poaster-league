"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { INTENTS, INTENT_ICONS } from "@/lib/constants/pro-writer";
import { IntentType } from "@/lib/types/pro-writer";
import { cn } from "@/lib/utils";

interface IntentPanelProps {
  selectedIntent: IntentType | null;
  onSelectIntent: (intent: IntentType | null) => void;
  required?: boolean;
}

export function IntentPanel({
  selectedIntent,
  onSelectIntent,
  required = false,
}: IntentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedIntentData = selectedIntent ? INTENTS[selectedIntent] : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Intent & Relationships</span>
            {selectedIntent && (
              <span className="text-xs text-muted-foreground">
                {selectedIntentData?.label}
              </span>
            )}
            {required && !selectedIntent && (
              <span className="text-xs text-muted-foreground">(required)</span>
            )}
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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            What move are you making?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.values(INTENTS).map((intent) => {
              const IconComponent =
                INTENT_ICONS[intent.icon as keyof typeof INTENT_ICONS];
              const isSelected = selectedIntent === intent.type;

              return (
                <TooltipProvider key={intent.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectIntent(
                            isSelected ? null : (intent.type as IntentType)
                          )
                        }
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          "hover:bg-accent",
                          isSelected
                            ? "border-primary bg-accent"
                            : "border-border"
                        )}
                      >
                        {IconComponent && (
                          <IconComponent className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium">
                            {intent.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {intent.definition}
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{intent.example}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

