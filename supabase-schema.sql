-- Supabase Database Schema for Poaster League
-- Run this in your Supabase SQL editor

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  twitter_user_id TEXT UNIQUE,
  handle TEXT,
  name TEXT,
  avatar_url TEXT,
  twitter_verified BOOLEAN DEFAULT false,
  write_permission BOOLEAN DEFAULT false,
  scout_active BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Write access requests
CREATE TABLE IF NOT EXISTS write_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  twitter_user_id TEXT NOT NULL,
  twitter_handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scout profiles
CREATE TABLE IF NOT EXISTS scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scout matches
CREATE TABLE IF NOT EXISTS scout_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_profile_id UUID REFERENCES scout_profiles(id) ON DELETE CASCADE,
  twitter_user_id TEXT NOT NULL,
  score NUMERIC NOT NULL,
  probability NUMERIC NOT NULL,
  snapshot_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table (migrated from SQLite)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  intent TEXT,
  relationships JSONB,
  post_to_twitter BOOLEAN DEFAULT false,
  post_to_pro_feed BOOLEAN DEFAULT true,
  twitter_post_id TEXT,
  twitter_reply_to_id TEXT,
  quality_checks JSONB,
  draft_maturity INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  intent TEXT,
  relationships JSONB,
  post_to_twitter BOOLEAN DEFAULT false,
  post_to_pro_feed BOOLEAN DEFAULT true,
  quality_checks JSONB,
  draft_maturity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Twitter OAuth tokens
CREATE TABLE IF NOT EXISTS twitter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  twitter_user_id TEXT,
  twitter_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Annotations (private replies visible only to the creator)
CREATE TABLE IF NOT EXISTS annotations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  relationships JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id) -- One annotation per user per post
);

-- Post tracking (users can track posts they want to follow)
CREATE TABLE IF NOT EXISTS post_tracking (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id) -- One tracking entry per user per post
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_twitter_user_id ON users(twitter_user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_user_id ON scout_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_scout_matches_scout_profile_id ON scout_matches(scout_profile_id);
CREATE INDEX IF NOT EXISTS idx_twitter_tokens_user_id ON twitter_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_twitter_tokens_twitter_user_id ON twitter_tokens(twitter_user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_post_id ON annotations(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_user_id ON post_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_post_id ON post_tracking(post_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_post_id ON annotations(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_user_id ON post_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_post_id ON post_tracking(post_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE write_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own data (for profile creation)
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Anyone can read published posts
CREATE POLICY "Anyone can read published posts" ON posts
  FOR SELECT USING (status = 'published');

-- Users can read their own posts
CREATE POLICY "Users can read own posts" ON posts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own posts
CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Authenticated users with write permission can create anonymous replies (user_id = null)
CREATE POLICY "Users can create anonymous replies" ON posts
  FOR INSERT WITH CHECK (
    user_id IS NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.write_permission = true
    )
  );

-- Users can read their own drafts
CREATE POLICY "Users can read own drafts" ON drafts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own drafts
CREATE POLICY "Users can create own drafts" ON drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own write requests
CREATE POLICY "Users can read own write requests" ON write_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own write requests
CREATE POLICY "Users can create own write requests" ON write_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can read all write requests
CREATE POLICY "Admins can read all write requests" ON write_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Admins can update any write request
CREATE POLICY "Admins can update write requests" ON write_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Users can read their own scout profiles
CREATE POLICY "Users can read own scout profiles" ON scout_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own scout profiles
CREATE POLICY "Users can create own scout profiles" ON scout_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own scout matches
CREATE POLICY "Users can read own scout matches" ON scout_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scout_profiles
      WHERE scout_profiles.id = scout_matches.scout_profile_id
      AND scout_profiles.user_id = auth.uid()
    )
  );

-- Users can read their own Twitter tokens
CREATE POLICY "Users can read own twitter tokens" ON twitter_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own Twitter tokens
CREATE POLICY "Users can insert own twitter tokens" ON twitter_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own Twitter tokens
CREATE POLICY "Users can update own twitter tokens" ON twitter_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own Twitter tokens
CREATE POLICY "Users can delete own twitter tokens" ON twitter_tokens
  FOR DELETE USING (auth.uid() = user_id);

