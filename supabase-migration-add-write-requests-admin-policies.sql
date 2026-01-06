-- Migration: Add admin policies for write_requests table
-- Run this in your Supabase SQL editor to allow admins to read and update write requests

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

