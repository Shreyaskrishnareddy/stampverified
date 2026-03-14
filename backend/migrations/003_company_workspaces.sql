-- ============================================================================
-- Migration 003: Company Workspaces
-- ============================================================================
-- Evolves the single-admin organization model into multi-member company
-- workspaces with granular permissions.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: 001_initial_schema.sql, 001_productmap_updates.sql, 002_education_dates.sql
--
-- What this does:
--   1. Creates the `company_members` table (multi-member workspaces)
--   2. Adds `website_url` to organizations (for company pages)
--   3. Adds `notification_preferences` to profiles (candidate notification control)
--   4. Migrates existing org admins into company_members as founding admins
--   5. Creates indexes for performance
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `company_members` table
-- ============================================================================
-- Every person on the employer side of Stamp is a company_member. This table
-- links auth.users to organizations with roles and permissions.
--
-- Key design decisions:
--   - `role` is either admin or member. Admins control the workspace.
--   - Permissions are boolean flags, not role-based. This allows granular control
--     without complex role hierarchies. An admin can grant "can post jobs" without
--     also granting "can verify claims."
--   - First person to register a company auto-becomes admin with all permissions.
--   - Subsequent members auto-join with no permissions. Admin grants them.
--   - One active membership per user per organization.
--   - Members join with personal company email (john@stripe.com), NOT the org's
--     role-based verifier email (hr@stripe.com). These are separate concerns.
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which organization this member belongs to
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Which auth user this member is
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The company email they signed up with (e.g., john@stripe.com)
    email VARCHAR(255) NOT NULL,

    -- Role: admin has full workspace control, member has limited access
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),

    -- Granular permissions (admin controls these for each member)
    can_post_jobs BOOLEAN NOT NULL DEFAULT FALSE,
    can_verify_claims BOOLEAN NOT NULL DEFAULT FALSE,

    -- Membership lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('invited', 'active', 'deactivated')),

    -- Who invited this member (null for self-join or founding admin)
    invited_by UUID REFERENCES company_members(id) ON DELETE SET NULL,

    -- Notification preferences: per-event toggles for in-app and email channels
    -- In-app defaults to on, email defaults to off. User controls everything.
    notification_preferences JSONB NOT NULL DEFAULT '{
        "in_app": {
            "new_application": true,
            "application_status": true,
            "new_message": true,
            "new_outreach": true,
            "claim_update": true,
            "member_joined": true,
            "job_expired": true
        },
        "email": {
            "new_application": false,
            "application_status": false,
            "new_message": false,
            "new_outreach": false,
            "claim_update": false,
            "member_joined": false,
            "job_expired": false
        }
    }'::jsonb,

    -- When the member accepted their invite or joined
    joined_at TIMESTAMPTZ,

    -- Record creation timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One membership per user per organization
    CONSTRAINT uq_company_members_org_user UNIQUE(organization_id, user_id),

    -- One membership per email per organization
    CONSTRAINT uq_company_members_org_email UNIQUE(organization_id, email)
);

-- Fast lookups by organization (list team members)
CREATE INDEX IF NOT EXISTS idx_company_members_org_id
    ON company_members(organization_id);

-- Fast lookups by user (find which org a user belongs to)
CREATE INDEX IF NOT EXISTS idx_company_members_user_id
    ON company_members(user_id);

-- Fast lookups by email (during join flow, check if invited)
CREATE INDEX IF NOT EXISTS idx_company_members_email
    ON company_members(email);

-- Fast filter for active members only
CREATE INDEX IF NOT EXISTS idx_company_members_active
    ON company_members(organization_id, status) WHERE status = 'active';

COMMENT ON TABLE company_members IS 'Members of company workspaces. Links auth users to organizations with roles and granular permissions.';
COMMENT ON COLUMN company_members.role IS 'admin = full workspace control (invite, permissions, settings). member = access controlled by permission flags.';
COMMENT ON COLUMN company_members.can_post_jobs IS 'Permission to create and manage job postings. Granted by admin.';
COMMENT ON COLUMN company_members.can_verify_claims IS 'Permission to verify, correct, or dispute candidate claims via the employer dashboard. Granted by admin.';
COMMENT ON COLUMN company_members.status IS 'invited = awaiting signup, active = full access, deactivated = removed by admin.';
COMMENT ON COLUMN company_members.notification_preferences IS 'Per-event toggles for in-app and email notification channels. In-app defaults on, email defaults off.';


-- ============================================================================
-- STEP 2: Add `website_url` to organizations
-- ============================================================================
-- Company pages show a clickable website link. Derived from domain on creation
-- but editable by admin.
-- ============================================================================

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Auto-populate from domain for existing orgs
UPDATE organizations
SET website_url = 'https://' || domain
WHERE website_url IS NULL;

COMMENT ON COLUMN organizations.website_url IS 'Company website URL. Shown on company pages. Defaults to https://{domain}.';


-- ============================================================================
-- STEP 3: Add `notification_preferences` to profiles
-- ============================================================================
-- Candidates control their own notification settings.
-- In-app defaults to on, email defaults to off.
-- ============================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
        "in_app": {
            "application_status": true,
            "new_message": true,
            "new_outreach": true,
            "claim_update": true
        },
        "email": {
            "application_status": false,
            "new_message": false,
            "new_outreach": false,
            "claim_update": false
        }
    }'::jsonb;

COMMENT ON COLUMN profiles.notification_preferences IS 'Per-event toggles for in-app and email notification channels. In-app defaults on, email defaults off.';


-- ============================================================================
-- STEP 4: Migrate existing org admins to company_members
-- ============================================================================
-- For every existing organization, find the auth user whose email matches
-- admin_email and create a company_member record with full admin privileges.
--
-- This ensures backward compatibility — existing org admins lose no access.
-- The ON CONFLICT clause makes this migration idempotent (safe to re-run).
-- ============================================================================

INSERT INTO company_members (
    organization_id,
    user_id,
    email,
    role,
    can_post_jobs,
    can_verify_claims,
    status,
    joined_at,
    created_at
)
SELECT
    o.id AS organization_id,
    u.id AS user_id,
    o.admin_email AS email,
    'admin' AS role,
    TRUE AS can_post_jobs,
    TRUE AS can_verify_claims,
    'active' AS status,
    o.created_at AS joined_at,
    o.created_at AS created_at
FROM organizations o
JOIN auth.users u ON LOWER(u.email) = LOWER(o.admin_email)
ON CONFLICT (organization_id, email) DO NOTHING;


-- ============================================================================
-- STEP 5: Log migration results
-- ============================================================================

DO $$
DECLARE
    member_count INTEGER;
    org_count INTEGER;
    unmigrated INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count FROM company_members;
    SELECT COUNT(*) INTO org_count FROM organizations;
    SELECT COUNT(*) INTO unmigrated FROM organizations o
        WHERE NOT EXISTS (
            SELECT 1 FROM company_members cm WHERE cm.organization_id = o.id
        );

    RAISE NOTICE 'Migration 003 complete:';
    RAISE NOTICE '  - company_members table created';
    RAISE NOTICE '  - % organizations total', org_count;
    RAISE NOTICE '  - % company_members created from existing admins', member_count;

    IF unmigrated > 0 THEN
        RAISE NOTICE '  - WARNING: % organizations have no matching auth user for admin_email', unmigrated;
        RAISE NOTICE '    These orgs will need manual member creation or will use the legacy admin_email fallback.';
    END IF;
END $$;
