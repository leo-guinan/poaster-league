-- Migration: Add reply support to posts table
-- Run this in your Supabase SQL editor if you already have the posts table

-- Add parent_post_id column for replies
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS parent_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL;

-- Add twitter_reply_to_id column to track which tweet this replies to
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS twitter_reply_to_id TEXT;

-- Create index for faster reply lookups
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);

