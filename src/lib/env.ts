/**
 * Environment variable validation
 * Ensures all required env vars are present
 */

function getEnvVar(key: string, required = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || "";
}

export const env = {
  // Supabase
  supabase: {
    url: getEnvVar("NEXT_PUBLIC_SUPABASE_URL", true),
    anonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", true),
  },
  
  // Community Archive
  communityArchive: {
    url: getEnvVar("NEXT_PUBLIC_CA_SUPABASE_URL", false),
    anonKey: getEnvVar("NEXT_PUBLIC_CA_SUPABASE_ANON_KEY", false),
  },
  
  // Twitter
  twitter: {
    clientId: getEnvVar("TWITTER_CLIENT_ID", false),
    clientSecret: getEnvVar("TWITTER_CLIENT_SECRET", false),
    baseUrl: getEnvVar("NEXT_PUBLIC_BASE_URL", false) || 
             (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
  },
  
  // App
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  
  // Scout Mode Paywall
  paywallLive: process.env.NEXT_PUBLIC_PAYWALL_LIVE === "true",
};

// Validate required env vars on import (server-side only)
if (typeof window === "undefined") {
  // Only validate Supabase on server
  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error("Missing required Supabase environment variables");
  }
}

