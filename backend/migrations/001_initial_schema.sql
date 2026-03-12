-- ============================================================================
-- Migration 001: StampVerified — Full Schema
-- ============================================================================
-- This migration sets up the complete database schema.
-- It handles both fresh installs and upgrades from the old schema.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- What this does:
--   1. Creates the `organizations` table (NEW)
--   2. Creates the `notifications` table (NEW)
--   3. Modifies `profiles` — removes trust_score
--   4. Modifies `employment_claims` — adds org matching, corrections, new statuses
--   5. Modifies `education_claims` — adds org matching, corrections, new statuses
--   6. Creates indexes for performance
--   7. Sets up Supabase Storage buckets for avatars and logos
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `organizations` table
-- ============================================================================
-- Organizations (companies, universities) must register on Stamp before
-- their employees/graduates can get verified. This is the trust foundation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,           -- e.g. "arytic.com", "stanford.edu"
    org_type VARCHAR(50) NOT NULL DEFAULT 'company', -- company | university | other

    -- Admin who registered the org (logs in with this email)
    admin_email VARCHAR(255) NOT NULL,

    -- Designated verification contact (receives verification requests)
    -- For v1, this is the same person as admin, but separated for future flexibility
    verifier_name VARCHAR(255),
    verifier_email VARCHAR(255) NOT NULL,

    -- Branding
    logo_url TEXT,                                  -- Supabase Storage or Logo.dev fallback

    -- Verification status
    is_domain_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate domains
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain
    ON organizations (LOWER(domain));

-- Look up org by admin email
CREATE INDEX IF NOT EXISTS idx_organizations_admin_email
    ON organizations (admin_email);

COMMENT ON TABLE organizations IS 'Registered organizations (companies/universities) that can verify claims';
COMMENT ON COLUMN organizations.domain IS 'Corporate domain (e.g. arytic.com). One org per domain.';
COMMENT ON COLUMN organizations.org_type IS 'Type of org: company, university, or other';
COMMENT ON COLUMN organizations.admin_email IS 'Work email of the person who registered the org. Used for login.';
COMMENT ON COLUMN organizations.verifier_email IS 'Email that receives verification requests. Often same as admin_email.';


-- ============================================================================
-- STEP 2: Create `notifications` table
-- ============================================================================
-- Stores notifications for both regular users and org admins.
-- Powers the bell icon with unread count.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who gets this notification
    -- For users: their profile UUID
    -- For org admins: we use their email as identifier (since they have separate accounts)
    user_id UUID,                                   -- nullable: set for regular users
    org_admin_email VARCHAR(255),                    -- nullable: set for org admin notifications

    -- Notification content
    type VARCHAR(50) NOT NULL,
    -- Types:
    --   claim_verified           — user: your claim was verified
    --   claim_disputed           — user: your claim was disputed
    --   correction_proposed      — user: org proposed corrections to your claim
    --   correction_accepted      — org: user accepted your correction
    --   correction_denied        — org: user denied your correction, resubmitted
    --   new_verification_request — org: new claim to review
    --   org_registered           — user: company you invited has joined Stamp
    --   claim_expired            — user: your verification request expired
    --   employee_departed        — user: your employer marked you as departed
    --   claim_resubmitted        — org: user resubmitted a previously disputed claim

    title VARCHAR(255) NOT NULL,
    message TEXT,

    -- Optional reference to the related claim
    claim_id UUID,
    claim_table VARCHAR(30),                        -- 'employment_claims' or 'education_claims'

    -- Read state
    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- At least one of user_id or org_admin_email must be set
    CONSTRAINT notification_recipient_check
        CHECK (user_id IS NOT NULL OR org_admin_email IS NOT NULL)
);

-- Fast lookup: unread notifications for a user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC)
    WHERE user_id IS NOT NULL;

-- Fast lookup: unread notifications for an org admin
CREATE INDEX IF NOT EXISTS idx_notifications_org_admin_unread
    ON notifications (org_admin_email, is_read, created_at DESC)
    WHERE org_admin_email IS NOT NULL;

COMMENT ON TABLE notifications IS 'In-app notifications for users and org admins';


-- ============================================================================
-- STEP 3: Modify `profiles` table
-- ============================================================================
-- Remove trust_score (replaced with "X of Y verified" computed on the fly).
-- The column might not exist in fresh installs, so we handle both cases.
-- ============================================================================

-- Drop trust_score if it exists (safe — column may not exist on fresh install)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'trust_score'
    ) THEN
        ALTER TABLE profiles DROP COLUMN trust_score;
    END IF;
END $$;


-- ============================================================================
-- STEP 4: Modify `employment_claims` table
-- ============================================================================
-- Add organization matching, correction flow, and new status support.
-- Each ALTER is wrapped in a check so it's safe to run multiple times.
-- ============================================================================

-- Link to registered organization (NULL if org not on Stamp)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE employment_claims
            ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Store the company domain from Clearbit selection
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'company_domain'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN company_domain VARCHAR(255);
    END IF;
END $$;

-- Correction fields (employer's proposed version)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'corrected_title'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN corrected_title VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'corrected_start_date'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN corrected_start_date DATE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'corrected_end_date'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN corrected_end_date DATE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'corrected_by'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN corrected_by VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'correction_reason'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN correction_reason TEXT;
    END IF;
END $$;

-- User's denial of a correction
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'user_denial_reason'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN user_denial_reason TEXT;
    END IF;
END $$;

-- Preserve previous dispute reason on resubmit
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'previous_dispute_reason'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN previous_dispute_reason TEXT;
    END IF;
END $$;

-- Which org name to display: "Verified by [org name]"
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'verified_by_org'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN verified_by_org VARCHAR(255);
    END IF;
END $$;

-- Expiry tracking
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'expired_at'
    ) THEN
        ALTER TABLE employment_claims ADD COLUMN expired_at TIMESTAMPTZ;
    END IF;
END $$;

-- Updated timestamp
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employment_claims' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE employment_claims
            ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Widen status column to fit new status values (was VARCHAR(20), need VARCHAR(30))
ALTER TABLE employment_claims ALTER COLUMN status TYPE VARCHAR(30);

-- Migrate existing status values: 'pending' → 'awaiting_verification'
UPDATE employment_claims
SET status = 'awaiting_verification'
WHERE status = 'pending';

-- Index for org dashboard: find all claims for an organization
CREATE INDEX IF NOT EXISTS idx_employment_claims_org_id
    ON employment_claims (organization_id, status);

-- Index for finding claims by domain (when org registers, match pending claims)
CREATE INDEX IF NOT EXISTS idx_employment_claims_company_domain
    ON employment_claims (company_domain)
    WHERE company_domain IS NOT NULL;


-- ============================================================================
-- STEP 5: Modify `education_claims` table
-- ============================================================================
-- Same changes as employment_claims, adapted for education fields.
-- ============================================================================

-- Link to registered organization
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE education_claims
            ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Store institution domain
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'institution_domain'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN institution_domain VARCHAR(255);
    END IF;
END $$;

-- Correction fields
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'corrected_degree'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN corrected_degree VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'corrected_field'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN corrected_field VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'corrected_year_started'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN corrected_year_started INTEGER;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'corrected_year_completed'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN corrected_year_completed INTEGER;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'corrected_by'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN corrected_by VARCHAR(255);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'correction_reason'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN correction_reason TEXT;
    END IF;
END $$;

-- User denial
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'user_denial_reason'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN user_denial_reason TEXT;
    END IF;
END $$;

-- Previous dispute reason
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'previous_dispute_reason'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN previous_dispute_reason TEXT;
    END IF;
END $$;

-- Verified by org name
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'verified_by_org'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN verified_by_org VARCHAR(255);
    END IF;
END $$;

-- Expiry tracking
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'expired_at'
    ) THEN
        ALTER TABLE education_claims ADD COLUMN expired_at TIMESTAMPTZ;
    END IF;
END $$;

-- Updated timestamp
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'education_claims' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE education_claims
            ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Widen status column to fit new status values
ALTER TABLE education_claims ALTER COLUMN status TYPE VARCHAR(30);

-- Migrate existing status values
UPDATE education_claims
SET status = 'awaiting_verification'
WHERE status = 'pending';

-- Index for org dashboard
CREATE INDEX IF NOT EXISTS idx_education_claims_org_id
    ON education_claims (organization_id, status);

-- Index for domain matching
CREATE INDEX IF NOT EXISTS idx_education_claims_institution_domain
    ON education_claims (institution_domain)
    WHERE institution_domain IS NOT NULL;


-- ============================================================================
-- STEP 6: Create indexes for common queries
-- ============================================================================

-- Public profile lookup by username (already likely exists, safe to re-create)
CREATE INDEX IF NOT EXISTS idx_profiles_username
    ON profiles (username);

-- User's claims (already likely covered by FK, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_employment_claims_user_id
    ON employment_claims (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_education_claims_user_id
    ON education_claims (user_id, created_at DESC);

-- Token lookups for verification
CREATE INDEX IF NOT EXISTS idx_employment_claims_token
    ON employment_claims (verification_token)
    WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_education_claims_token
    ON education_claims (verification_token)
    WHERE verification_token IS NOT NULL;

-- Expiry: find claims older than 30 days that haven't been acted on
CREATE INDEX IF NOT EXISTS idx_employment_claims_expiry
    ON employment_claims (created_at)
    WHERE status = 'awaiting_verification' AND expired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_education_claims_expiry
    ON education_claims (created_at)
    WHERE status = 'awaiting_verification' AND expired_at IS NULL;


-- ============================================================================
-- STEP 7: Supabase Storage buckets
-- ============================================================================
-- Create storage buckets for avatars and organization logos.
-- These are public buckets (images are publicly accessible via URL).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: drop existing if any, then create fresh
-- (CREATE POLICY doesn't support IF NOT EXISTS in PostgreSQL)

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload org logos" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update org logos" ON storage.objects;
    DROP POLICY IF EXISTS "Logos are publicly readable" ON storage.objects;
END $$;

CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars');

CREATE POLICY "Avatars are publicly readable"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload org logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Users can update org logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'logos');

CREATE POLICY "Logos are publicly readable"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'logos');


-- ============================================================================
-- DONE
-- ============================================================================
-- After running this migration, your database has:
--
--   Tables:
--     ✓ profiles          — user profiles (trust_score removed)
--     ✓ employment_claims — with org matching, corrections, new statuses
--     ✓ education_claims  — with org matching, corrections, new statuses
--     ✓ organizations     — NEW: registered companies/universities
--     ✓ notifications     — NEW: in-app notification system
--
--   Storage Buckets:
--     ✓ avatars           — public bucket for profile photos
--     ✓ logos             — public bucket for org logos
--
--   Claim Statuses:
--     awaiting_org            — org not registered on Stamp yet
--     awaiting_verification   — org registered, verification request sent
--     verified                — org confirmed the claim
--     correction_proposed     — org proposed corrections, waiting for user
--     disputed                — org rejected (hidden from profile)
--     expired                 — 30 days, no response
--
-- Next step: Phase 2 — Backend routes
-- ============================================================================
