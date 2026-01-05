import { Suspense } from "react";
import { ProFeed } from "@/components/pro-feed/pro-feed";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      }>
        <ProFeed />
      </Suspense>
    </div>
  );
}
