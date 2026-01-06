-- Migration: Add is_admin column to users table
-- Run this in your Supabase SQL editor if you already have the users table

-- Add is_admin column (defaults to false)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

-- Example: Grant admin access to a specific user by email
-- Replace 'your-email@example.com' with your actual email
-- UPDATE users 
-- SET is_admin = true 
-- WHERE id IN (
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );

