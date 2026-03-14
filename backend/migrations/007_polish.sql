-- ============================================================================
-- Migration 007: Company Requests & Saved Companies
-- ============================================================================
-- Adds the "Request company" flow for companies not in Clearbit,
-- and saved companies bookmarking for candidates.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: 006_messaging.sql
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `company_requests` table
-- ============================================================================
-- When a company isn't found in Clearbit, employers can request it.
-- The Stamp team reviews and approves manually for MVP.
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who requested
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requester_email VARCHAR(255) NOT NULL,

    -- Company details
    company_name VARCHAR(255) NOT NULL,
    company_domain VARCHAR(255) NOT NULL,
    company_website TEXT,

    -- Review status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_requests_status
    ON company_requests(status) WHERE status = 'pending';

COMMENT ON TABLE company_requests IS 'Requests to add companies not found in Clearbit. Manually reviewed for MVP.';


-- ============================================================================
-- STEP 2: Create `saved_companies` table
-- ============================================================================
-- Candidates can save/follow companies to get notified when they post jobs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_saved_companies_user_org UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_companies_user
    ON saved_companies(user_id);

COMMENT ON TABLE saved_companies IS 'Companies saved/followed by candidates. Notified when new jobs are posted.';


-- ============================================================================
-- STEP 3: Log
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 007 complete:';
    RAISE NOTICE '  - company_requests table created';
    RAISE NOTICE '  - saved_companies table created';
END $$;
