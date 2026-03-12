-- Migration: Change education claims from year (INTEGER) to full dates (DATE)
-- Run this in Supabase SQL Editor

-- Rename year columns to date columns
ALTER TABLE education_claims RENAME COLUMN year_started TO start_date;
ALTER TABLE education_claims RENAME COLUMN year_completed TO end_date;

-- Change type from INTEGER to DATE
ALTER TABLE education_claims ALTER COLUMN start_date TYPE DATE USING NULL;
ALTER TABLE education_claims ALTER COLUMN end_date TYPE DATE USING NULL;

-- Rename correction columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'education_claims' AND column_name = 'corrected_year_started') THEN
    ALTER TABLE education_claims RENAME COLUMN corrected_year_started TO corrected_start_date;
    ALTER TABLE education_claims ALTER COLUMN corrected_start_date TYPE DATE USING NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'education_claims' AND column_name = 'corrected_year_completed') THEN
    ALTER TABLE education_claims RENAME COLUMN corrected_year_completed TO corrected_end_date;
    ALTER TABLE education_claims ALTER COLUMN corrected_end_date TYPE DATE USING NULL;
  END IF;
END $$;
