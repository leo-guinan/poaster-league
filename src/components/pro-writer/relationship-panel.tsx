"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { RELATIONSHIPS } from "@/lib/constants/pro-writer";
import { RelationshipType } from "@/lib/types/pro-writer";
import { cn } from "@/lib/utils";

interface RelationshipPanelProps {
  selectedRelationships: RelationshipType[];
  onSelectRelationship: (relationship: RelationshipType) => void;
  required?: boolean;
}

const MAX_RELATIONSHIPS = 2;

export function RelationshipPanel({
  selectedRelationships,
  onSelectRelationship,
  required = false,
}: RelationshipPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Relationship Targeting</span>
            {selectedRelationships.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedRelationships.length} selected
              </span>
            )}
            {required && selectedRelationships.length === 0 && (
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
            What relationships should this post move forward?
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.values(RELATIONSHIPS).map((relationship) => {
              const isSelected = selectedRelationships.includes(
                relationship.type
              );
              const isDisabled =
                !isSelected &&
                selectedRelationships.length >= MAX_RELATIONSHIPS;

              return (
                <button
                  key={relationship.type}
                  type="button"
                  onClick={() => onSelectRelationship(relationship.type)}
                  disabled={isDisabled}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent",
                    !isDisabled && "hover:border-primary/50"
                  )}
                >
                  {relationship.label}
                </button>
              );
            })}
          </div>
          {selectedRelationships.length >= MAX_RELATIONSHIPS && (
            <p className="text-xs text-muted-foreground">
              Maximum {MAX_RELATIONSHIPS} relationships selected
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

