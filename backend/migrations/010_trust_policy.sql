-- ============================================================================
-- Migration 010: Trust Policy Enforcement
-- ============================================================================
-- Implements block/report for candidates and DNS verification for companies.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: Migration 009
--
-- What this does:
--   1. Creates blocked_companies table (candidate blocks org from contacting them)
--   2. Adds dns_verification_token to organizations (for DNS TXT verification)
--   3. Updates delete_user_account() to clean up blocks
-- ============================================================================


-- ============================================================================
-- STEP 1: Create blocked_companies table
-- ============================================================================
-- Candidates can block specific companies from contacting them.
-- Blocked companies cannot send outreach or see the candidate in search.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocked_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_blocked_companies UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_companies_user
    ON blocked_companies(user_id);

COMMENT ON TABLE blocked_companies IS 'Candidates can block specific companies from contacting them or seeing them in search.';


-- ============================================================================
-- STEP 2: Add DNS verification fields to organizations
-- ============================================================================
-- dns_verification_token: a random token the org must add as a DNS TXT record
-- dns_verified_at: when DNS verification was completed
-- ============================================================================

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS dns_verification_token VARCHAR(64);

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS dns_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.dns_verification_token IS 'Token that must be set as DNS TXT record for domain verification. Format: stamp-verify=TOKEN';
COMMENT ON COLUMN organizations.dns_verified_at IS 'When DNS TXT verification was completed.';


-- ============================================================================
-- STEP 3: Update delete_user_account()
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM messages WHERE sender_type = 'candidate' AND sender_id = target_user_id;
    DELETE FROM conversations WHERE candidate_id = target_user_id;
    DELETE FROM applications WHERE candidate_id = target_user_id;
    DELETE FROM saved_jobs WHERE user_id = target_user_id;
    DELETE FROM saved_companies WHERE user_id = target_user_id;
    DELETE FROM blocked_companies WHERE user_id = target_user_id;
    DELETE FROM candidate_preferences WHERE user_id = target_user_id;
    DELETE FROM notifications WHERE user_id = target_user_id;
    DELETE FROM education_claims WHERE user_id = target_user_id;
    DELETE FROM employment_claims WHERE user_id = target_user_id;
    DELETE FROM company_members WHERE user_id = target_user_id;
    UPDATE audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;
    DELETE FROM profiles WHERE id = target_user_id;
END;
$$;


DO $$
BEGIN
    RAISE NOTICE 'Migration 010 complete:';
    RAISE NOTICE '  - blocked_companies table created';
    RAISE NOTICE '  - dns_verification_token and dns_verified_at added to organizations';
    RAISE NOTICE '  - delete_user_account() updated';
END $$;
