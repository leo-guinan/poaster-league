-- Placeholder Accounts Table
-- Stores accounts from Community Archive that haven't been claimed yet
-- When a user authenticates with Twitter, if their Twitter ID matches a placeholder,
-- the placeholder data is merged into their user account

CREATE TABLE IF NOT EXISTS placeholder_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_user_id TEXT UNIQUE NOT NULL,
  handle TEXT,
  name TEXT,
  avatar_url TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_placeholder_accounts_twitter_user_id ON placeholder_accounts(twitter_user_id);
CREATE INDEX IF NOT EXISTS idx_placeholder_accounts_claimed_by ON placeholder_accounts(claimed_by);

-- RLS Policies
ALTER TABLE placeholder_accounts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read placeholder accounts (for checking if account exists)
CREATE POLICY "Anyone can read placeholder accounts"
  ON placeholder_accounts
  FOR SELECT
  USING (true);

-- Allow service role to insert/update/delete placeholder accounts
-- (This will be done via the populate script with service role key)
-- Note: Service role bypasses RLS, but we add this for clarity
CREATE POLICY "Service role can manage placeholder accounts"
  ON placeholder_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

