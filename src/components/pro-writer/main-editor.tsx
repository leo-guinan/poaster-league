"use client";

import { cn } from "@/lib/utils";

interface MainEditorProps {
  content: string;
  onChange: (content: string) => void;
  postToTwitter: boolean;
  postToProFeed: boolean;
  onTwitterToggle: (value: boolean) => void;
  onProFeedToggle: (value: boolean) => void;
  draftMaturity: number;
}

const TWITTER_MAX_LENGTH = 280;

export function MainEditor({
  content,
  onChange,
  postToTwitter,
  postToProFeed,
  onTwitterToggle,
  onProFeedToggle,
  draftMaturity,
}: MainEditorProps) {
  const charCount = content.length;
  const isOverLimit = charCount > TWITTER_MAX_LENGTH;

  return (
    <div className="flex flex-col space-y-4">
      {/* Editor */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What move are you making?"
          className={cn(
            "w-full min-h-[200px] resize-none border-0 bg-transparent p-0 text-lg",
            "focus:outline-none focus:ring-0",
            "placeholder:text-muted-foreground/50"
          )}
        />
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-6">
          {/* Character Count */}
          <div
            className={cn(
              "text-sm font-mono",
              isOverLimit
                ? "text-destructive"
                : charCount > TWITTER_MAX_LENGTH * 0.9
                  ? "text-muted-foreground"
                  : "text-muted-foreground/70"
            )}
          >
            {charCount}
            {postToTwitter && ` / ${TWITTER_MAX_LENGTH}`}
          </div>

          {/* Draft Maturity Indicator */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={cn(
                  "h-2 w-2 rounded-full",
                  index < draftMaturity
                    ? "bg-primary"
                    : "bg-muted border border-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Distribution Toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={postToTwitter}
              onChange={(e) => onTwitterToggle(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-muted-foreground">Post to Twitter</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={postToProFeed}
              onChange={(e) => onProFeedToggle(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-muted-foreground">Pro Feed</span>
          </label>
        </div>
      </div>
    </div>
  );
}

