-- Add a compound index to support the open leaderboard sorting
-- We sort by amount_paid DESC, created_at ASC for tie-breaking
CREATE INDEX IF NOT EXISTS idx_replacements_leaderboard 
ON public.replacements (amount_paid DESC, created_at ASC);
