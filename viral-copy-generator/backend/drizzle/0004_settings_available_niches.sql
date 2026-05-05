-- Phase 11: Add user-configurable niche list to settings
-- Users can now add custom niches (e.g. "real estate", "fitness")
-- Default set contains 8 standard niches

ALTER TABLE public.settings
  ADD COLUMN available_niches text[]
    NOT NULL DEFAULT ARRAY['travel','hotels','cars','bikes','coding','lifestyle','food','other']::text[];
