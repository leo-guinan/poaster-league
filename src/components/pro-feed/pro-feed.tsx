"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { PostCard } from "./post-card";
import { AuthButton } from "@/components/user/auth-button";
import { WriteAccessBanner } from "@/components/user/write-access-banner";
import { ScoutModeButton } from "@/components/scout/scout-mode-button";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PenTool } from "lucide-react";
import { IntentType, RelationshipType } from "@/lib/types/pro-writer";
import { trackEvent, trackPageView, FATHOM_EVENTS } from "@/lib/analytics";

interface Post {
  id: number;
  content: string;
  intent: IntentType | null;
  relationships: string[];
  createdAt: Date | string | number;
  publishedAt: Date | string | number | null;
  twitter_post_id: string | null; // Database field name
  twitterPostId?: string | null; // Mapped field name
  status: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ProFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [intentFilter, setIntentFilter] = useState<string>("");

  // Track page view on mount
  useEffect(() => {
    trackPageView("/");
    trackEvent(FATHOM_EVENTS.PAGE_VIEW_FEED);
  }, []);

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, intentFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (intentFilter) {
        params.append("intent", intentFilter);
      }

      const response = await fetch(`/api/posts?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setPosts(data.posts);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && pagination && newPage <= pagination.totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-12 flex items-center justify-between border-b border-border pb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <NextImage
              src="/logo.svg"
              alt="Poaster League"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
          </Link>
          <div>
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">PRO FEED</h1>
            <p className="text-sm text-muted-foreground">Active Moves</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoutModeButton />
          <AuthButton />
          <Link href="/write">
            <Button variant="outline">
              <PenTool className="mr-2 h-4 w-4" />
              Write
            </Button>
          </Link>
        </div>
      </div>

      {/* Write Access Banner */}
      <Suspense fallback={null}>
        <WriteAccessBanner />
      </Suspense>

      {/* Filters */}
      <div className="mb-8 flex items-center gap-4">
        <select
          value={intentFilter}
          onChange={(e) => {
            setIntentFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All Intents</option>
          <option value="explore">Explore</option>
          <option value="propose">Propose</option>
          <option value="argue">Argue</option>
          <option value="synthesize">Synthesize</option>
          <option value="teach">Teach</option>
          <option value="signal">Signal</option>
          <option value="invite">Invite</option>
        </select>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No posts found.
        </div>
      ) : (
        <>
          <div className="space-y-0">
            {posts.map((post) => {
              const createdAt = post.createdAt instanceof Date 
                ? post.createdAt 
                : new Date(post.createdAt);
              const publishedAt = post.publishedAt
                ? (post.publishedAt instanceof Date 
                    ? post.publishedAt 
                    : new Date(post.publishedAt))
                : null;

              return (
                <PostCard
                  key={post.id}
                  id={post.id}
                  content={post.content}
                  intent={post.intent}
                  relationships={
                    Array.isArray(post.relationships)
                      ? (post.relationships as RelationshipType[])
                      : []
                  }
                  createdAt={createdAt}
                  publishedAt={publishedAt}
                  twitterPostId={post.twitter_post_id || post.twitterPostId || null}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-between border-t border-border pt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={!pagination.hasPrev}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!pagination.hasNext}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

