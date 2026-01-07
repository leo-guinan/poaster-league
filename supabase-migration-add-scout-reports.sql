-- Scout Mode Reports and Enhanced Profiles
-- Run this after the main schema

-- Update scout_profiles to match new structure
-- The config JSONB will store:
-- {
--   "intentShapes": ["propose", "synthesize", ...],
--   "domain": "AI safety tooling" (optional),
--   "relationshipTarget": "collaborator" | "hire" | "mentor" | "peer" | "investment" | "track",
--   "sensitivity": "emerging" | "established" (default: slightly toward emerging),
--   "active": true/false (redundant with scout_profiles.active but kept for consistency)
-- }

-- Scout reports (weekly aggregations)
CREATE TABLE IF NOT EXISTS scout_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_profile_id UUID REFERENCES scout_profiles(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  candidate_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scout_profile_id, report_date)
);

-- Scout report candidates (individual matches in reports)
CREATE TABLE IF NOT EXISTS scout_report_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_report_id UUID REFERENCES scout_reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  twitter_user_id TEXT, -- May not have user account yet
  match_confidence INTEGER NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 100),
  reasoning TEXT NOT NULL,
  sample_post_ids INTEGER[] DEFAULT '{}', -- Array of post IDs that match
  revealed BOOLEAN DEFAULT false, -- Whether user has clicked to reveal identity
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scout_reports_scout_profile_id ON scout_reports(scout_profile_id);
CREATE INDEX IF NOT EXISTS idx_scout_reports_report_date ON scout_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_scout_report_candidates_report_id ON scout_report_candidates(scout_report_id);
CREATE INDEX IF NOT EXISTS idx_scout_report_candidates_user_id ON scout_report_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_scout_report_candidates_twitter_user_id ON scout_report_candidates(twitter_user_id);

-- Row Level Security
ALTER TABLE scout_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_report_candidates ENABLE ROW LEVEL SECURITY;

-- Users can read their own scout reports
CREATE POLICY "Users can read own scout reports" ON scout_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scout_profiles
      WHERE scout_profiles.id = scout_reports.scout_profile_id
      AND scout_profiles.user_id = auth.uid()
    )
  );

-- Users can read their own scout report candidates
CREATE POLICY "Users can read own scout report candidates" ON scout_report_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scout_reports
      JOIN scout_profiles ON scout_profiles.id = scout_reports.scout_profile_id
      WHERE scout_reports.id = scout_report_candidates.scout_report_id
      AND scout_profiles.user_id = auth.uid()
    )
  );

-- Users can update their own scout report candidates (to mark as revealed)
CREATE POLICY "Users can update own scout report candidates" ON scout_report_candidates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM scout_reports
      JOIN scout_profiles ON scout_profiles.id = scout_reports.scout_profile_id
      WHERE scout_reports.id = scout_report_candidates.scout_report_id
      AND scout_profiles.user_id = auth.uid()
    )
  );

