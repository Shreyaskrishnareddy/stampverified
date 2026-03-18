-- ============================================================================
-- Migration 009: Verification Hardening
-- ============================================================================
-- Security and trust infrastructure changes from verification audit.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: All previous migrations (001-008)
--
-- What this does:
--   1. Adds 'pending' status to company_members (admin approval for self-join)
--   2. Adds token_expires_at to employment_claims and education_claims (30-day TTL)
--   3. Creates audit_logs table
--   4. Updates delete_user_account() for audit_logs
-- ============================================================================


-- ============================================================================
-- STEP 1: Add 'pending' status to company_members
-- ============================================================================
-- Self-join via domain match now creates a 'pending' member that requires
-- admin approval before activation.
-- ============================================================================

ALTER TABLE company_members
    DROP CONSTRAINT IF EXISTS company_members_status_check;

ALTER TABLE company_members
    ADD CONSTRAINT company_members_status_check
    CHECK (status IN ('invited', 'active', 'pending', 'deactivated'));


-- ============================================================================
-- STEP 2: Add token_expires_at to claims tables
-- ============================================================================
-- Verification tokens now expire after 30 days. The cron job checks this
-- and the verify endpoint validates it.
-- ============================================================================

ALTER TABLE employment_claims
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

ALTER TABLE education_claims
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Set token_expires_at for existing awaiting_verification claims
-- (30 days from now, giving existing claims a grace period)
UPDATE employment_claims
SET token_expires_at = NOW() + INTERVAL '30 days'
WHERE status = 'awaiting_verification'
  AND token_expires_at IS NULL
  AND verification_token IS NOT NULL;

UPDATE education_claims
SET token_expires_at = NOW() + INTERVAL '30 days'
WHERE status = 'awaiting_verification'
  AND token_expires_at IS NULL
  AND verification_token IS NOT NULL;

COMMENT ON COLUMN employment_claims.token_expires_at IS 'When the verification token expires. Tokens are valid for 30 days.';
COMMENT ON COLUMN education_claims.token_expires_at IS 'When the verification token expires. Tokens are valid for 30 days.';


-- ============================================================================
-- STEP 3: Create audit_logs table
-- ============================================================================
-- Tracks all verification, permission, and security-relevant actions.
-- Immutable append-only log.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who performed the action
    actor_id UUID,                               -- auth user ID or NULL for system
    actor_type VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (actor_type IN ('user', 'member', 'system')),

    -- What happened
    action VARCHAR(50) NOT NULL,                 -- e.g. 'verified', 'disputed', 'permission_granted'

    -- What was affected
    resource_type VARCHAR(50) NOT NULL,          -- e.g. 'claim', 'job', 'member', 'organization'
    resource_id UUID,                            -- ID of the affected resource

    -- Additional context
    metadata JSONB DEFAULT '{}'::jsonb,          -- action-specific details
    ip_address INET,                             -- client IP when available

    -- When it happened
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
    ON audit_logs(resource_type, resource_id);

-- Fast lookups by actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs(actor_id);

-- Fast lookups by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

-- Chronological queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for verification, permission, and security-relevant actions.';


-- ============================================================================
-- STEP 4: Update delete_user_account() for audit_logs
-- ============================================================================
-- Audit logs are NOT deleted when a user deletes their account.
-- They are anonymized instead (actor_id set to NULL).
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete messages where user is a sender (as candidate)
    DELETE FROM messages WHERE sender_type = 'candidate' AND sender_id = target_user_id;

    -- Delete conversations where user is the candidate
    DELETE FROM conversations WHERE candidate_id = target_user_id;

    -- Delete applications
    DELETE FROM applications WHERE candidate_id = target_user_id;

    -- Delete saved jobs and saved companies
    DELETE FROM saved_jobs WHERE user_id = target_user_id;
    DELETE FROM saved_companies WHERE user_id = target_user_id;

    -- Delete candidate preferences
    DELETE FROM candidate_preferences WHERE user_id = target_user_id;

    -- Delete notifications
    DELETE FROM notifications WHERE user_id = target_user_id;

    -- Delete claims
    DELETE FROM education_claims WHERE user_id = target_user_id;
    DELETE FROM employment_claims WHERE user_id = target_user_id;

    -- Delete company memberships (references auth.users, not profiles)
    DELETE FROM company_members WHERE user_id = target_user_id;

    -- Anonymize audit logs (preserve the trail, remove the actor)
    UPDATE audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;

    -- Delete profile (must be last — other FKs reference it)
    DELETE FROM profiles WHERE id = target_user_id;
END;
$$;


-- ============================================================================
-- STEP 5: Log migration results
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 009 complete:';
    RAISE NOTICE '  - company_members status CHECK updated to include pending';
    RAISE NOTICE '  - token_expires_at added to employment_claims and education_claims';
    RAISE NOTICE '  - audit_logs table created';
    RAISE NOTICE '  - delete_user_account() updated to anonymize audit logs';
END $$;
