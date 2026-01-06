-- Migration: Add annotations and tracking tables
-- Run this in your Supabase SQL editor

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
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_post_id ON annotations(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_user_id ON post_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_post_tracking_post_id ON post_tracking(post_id);

-- Enable RLS
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for annotations
CREATE POLICY "Users can read own annotations" ON annotations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own annotations" ON annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations" ON annotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations" ON annotations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for post_tracking
CREATE POLICY "Users can read own tracked posts" ON post_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tracked posts" ON post_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked posts" ON post_tracking
  FOR DELETE USING (auth.uid() = user_id);

