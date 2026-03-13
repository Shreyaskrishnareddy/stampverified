-- Migration: PRODUCTMAP decisions implementation
-- Run this in Supabase SQL Editor before deploying the new code.

-- 1. Add dispute_count to employment_claims (for 5-dispute resubmission limit)
ALTER TABLE employment_claims ADD COLUMN IF NOT EXISTS dispute_count INTEGER DEFAULT 0;

-- 2. Add dispute_count to education_claims
ALTER TABLE education_claims ADD COLUMN IF NOT EXISTS dispute_count INTEGER DEFAULT 0;

-- 3. Atomic account deletion function
-- Deletes all user data in a single transaction. If any step fails, nothing is deleted.
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM notifications WHERE user_id = target_user_id;
    DELETE FROM education_claims WHERE user_id = target_user_id;
    DELETE FROM employment_claims WHERE user_id = target_user_id;
    DELETE FROM profiles WHERE id = target_user_id;
END;
$$;
