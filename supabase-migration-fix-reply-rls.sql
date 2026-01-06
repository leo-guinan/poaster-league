-- Migration: Fix RLS policy for anonymous replies
-- Run this in your Supabase SQL editor to allow authenticated users with write permission
-- to create anonymous replies (posts with user_id = null)

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

