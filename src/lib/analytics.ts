/**
 * Fathom Analytics Event Tracking
 * 
 * This module provides type-safe event tracking for Fathom Analytics.
 * All events should be defined here to maintain consistency.
 */

// Fathom event names - keep these in sync with your Fathom dashboard
export const FATHOM_EVENTS = {
  // Authentication
  SIGN_IN: "SIGN_IN",
  SIGN_UP: "SIGN_UP",
  SIGN_OUT: "SIGN_OUT",
  TWITTER_CONNECT: "TWITTER_CONNECT",
  TWITTER_DISCONNECT: "TWITTER_DISCONNECT",

  // Writing & Publishing
  POST_PUBLISHED: "POST_PUBLISHED",
  POST_PUBLISHED_TO_TWITTER: "POST_PUBLISHED_TO_TWITTER",
  DRAFT_SAVED: "DRAFT_SAVED",
  REPLY_POSTED: "REPLY_POSTED",
  REPLY_POSTED_TO_TWITTER: "REPLY_POSTED_TO_TWITTER",

  // Write Access
  WRITE_ACCESS_REQUESTED: "WRITE_ACCESS_REQUESTED",
  WRITE_ACCESS_GRANTED: "WRITE_ACCESS_GRANTED",

  // Scout Mode
  SCOUT_MODE_ACTIVATED: "SCOUT_MODE_ACTIVATED",
  SCOUT_MATCH_CREATED: "SCOUT_MATCH_CREATED",

  // Engagement
  POST_RESPONDED: "POST_RESPONDED",
  POST_ANNOTATED: "POST_ANNOTATED",
  POST_TRACKED: "POST_TRACKED",

  // Navigation
  PAGE_VIEW_WRITE: "PAGE_VIEW_WRITE",
  PAGE_VIEW_SCOUT: "PAGE_VIEW_SCOUT",
  PAGE_VIEW_FEED: "PAGE_VIEW_FEED",
} as const;

export type FathomEvent = typeof FATHOM_EVENTS[keyof typeof FATHOM_EVENTS];

/**
 * Track a Fathom analytics event
 * 
 * @param eventName - The event name from FATHOM_EVENTS
 * @param value - Optional numeric value for the event
 */
export function trackEvent(eventName: FathomEvent, value?: number): void {
  // Only track in browser environment
  if (typeof window === "undefined") {
    return;
  }

  // Check if Fathom is loaded
  const fathom = (window as { fathom?: { trackEvent: (event: string, value?: number) => void } }).fathom;
  
  if (!fathom) {
    // Silently fail in development - Fathom might not be loaded yet
    if (process.env.NODE_ENV === "development") {
      console.debug(`[Analytics] Event not tracked (Fathom not loaded): ${eventName}`, value ? `value: ${value}` : "");
    }
    return;
  }

  try {
    fathom.trackEvent(eventName, value);
    if (process.env.NODE_ENV === "development") {
      console.debug(`[Analytics] Tracked: ${eventName}`, value ? `value: ${value}` : "");
    }
  } catch (error) {
    // Silently fail - don't break the app if analytics fails
    console.error("[Analytics] Error tracking event:", error);
  }
}

/**
 * Track page view (for client-side navigation)
 */
export function trackPageView(url?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const fathom = (window as { fathom?: { trackPageview: (options?: { url?: string }) => void } }).fathom;
  
  if (!fathom) {
    return;
  }

  try {
    fathom.trackPageview(url ? { url } : undefined);
  } catch (error) {
    console.error("[Analytics] Error tracking page view:", error);
  }
}

/**
 * Declare Fathom types for TypeScript
 */
declare global {
  interface Window {
    fathom?: {
      trackEvent: (event: string, value?: number) => void;
      trackPageview: (options?: { url?: string }) => void;
    };
  }
}

