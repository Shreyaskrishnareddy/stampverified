-- ============================================================================
-- Migration 005: Applications, Candidate Preferences, Saved Jobs
-- ============================================================================
-- Adds the apply flow, candidate preferences (resume, open_to_work,
-- preferred functions), and saved jobs bookmarking.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: 004_jobs.sql
--
-- What this does:
--   1. Creates `candidate_preferences` table (open_to_work, resume, functions)
--   2. Creates `applications` table (apply flow + status tracking)
--   3. Creates `saved_jobs` table (bookmarking)
--   4. Creates Supabase Storage bucket for resumes (private)
--   5. Creates indexes
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `candidate_preferences` table
-- ============================================================================
-- Stores candidate-level settings that power the platform:
--   - open_to_work: discoverable by employers in talent search
--   - resume_url: uploaded resume in private storage
--   - resume_visible: whether verified employers can see the resume
--   - preferred_functions: job function IDs for feed personalization
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

    -- Discovery
    open_to_work BOOLEAN NOT NULL DEFAULT FALSE,

    -- Resume
    resume_url TEXT,                                -- Supabase Storage path (private bucket)
    resume_visible BOOLEAN NOT NULL DEFAULT TRUE,   -- Visible to verified employers by default

    -- Job function preferences (powers feed sort + matching)
    preferred_functions UUID[] DEFAULT '{}',        -- Array of job_function IDs

    -- Timestamps
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE candidate_preferences IS 'Candidate platform preferences: discovery, resume, job function interests.';
COMMENT ON COLUMN candidate_preferences.open_to_work IS 'If true, candidate appears in employer talent search. Never shown on public profile.';
COMMENT ON COLUMN candidate_preferences.resume_url IS 'Path to resume in private Supabase Storage bucket. Served via signed URLs.';
COMMENT ON COLUMN candidate_preferences.resume_visible IS 'If true, verified employers can view resume in talent search. Default true to save recruiter time.';
COMMENT ON COLUMN candidate_preferences.preferred_functions IS 'Array of job_function UUIDs. Powers "Most Relevant" sort and matching.';


-- ============================================================================
-- STEP 2: Create `applications` table
-- ============================================================================
-- Every job application on the platform. Links a candidate to a job
-- with a resume snapshot and optional cover note.
--
-- Key design decisions:
--   - resume_snapshot_url is a COPY of the resume at apply time. The employer
--     always sees the version submitted, even if the candidate updates later.
--   - UNIQUE(job_id, candidate_id) prevents duplicate applications.
--   - Status flow: applied → shortlisted → rejected (or withdrawn by candidate)
--   - Candidates see status changes in their applications dashboard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which job and who applied
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Resume snapshot (copy at apply time)
    resume_snapshot_url TEXT,

    -- Optional cover note from candidate
    cover_note TEXT,

    -- Application lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'applied'
        CHECK (status IN ('applied', 'shortlisted', 'rejected', 'withdrawn')),

    -- Timestamps
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One application per candidate per job
    CONSTRAINT uq_applications_job_candidate UNIQUE(job_id, candidate_id)
);

-- Applications by job (employer inbox: list applications for a job)
CREATE INDEX IF NOT EXISTS idx_applications_job_id
    ON applications(job_id);

-- Applications by candidate (candidate dashboard: my applications)
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id
    ON applications(candidate_id);

-- Active applications (exclude withdrawn)
CREATE INDEX IF NOT EXISTS idx_applications_active
    ON applications(job_id, status) WHERE status != 'withdrawn';

COMMENT ON TABLE applications IS 'Job applications. Each links a candidate to a job with a resume snapshot and status tracking.';
COMMENT ON COLUMN applications.resume_snapshot_url IS 'Copy of candidate resume at application time. Employer always sees submitted version.';
COMMENT ON COLUMN applications.status IS 'applied = submitted, shortlisted = recruiter interested, rejected = not selected, withdrawn = candidate withdrew.';


-- ============================================================================
-- STEP 3: Create `saved_jobs` table
-- ============================================================================
-- Simple bookmarking. Candidates save jobs they're interested in.
-- Works before verification — creates engagement early.
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One bookmark per user per job
    CONSTRAINT uq_saved_jobs_user_job UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id
    ON saved_jobs(user_id);

COMMENT ON TABLE saved_jobs IS 'Bookmarked jobs. Candidates can save jobs before verification.';


-- ============================================================================
-- STEP 4: Create Supabase Storage bucket for resumes
-- ============================================================================
-- Private bucket — files served via signed URLs through the backend.
-- Only the resume owner can upload. Employers access via API.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Drop policies if they exist (makes it safe to re-run)
DROP POLICY IF EXISTS "Users upload own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users update own resume" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own resume" ON storage.objects;

-- Policy: only the owner can upload/update their resume
CREATE POLICY "Users upload own resume"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users update own resume"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users delete own resume"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- No public SELECT policy — files served via signed URLs through backend


-- ============================================================================
-- STEP 5: Log migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 005 complete:';
    RAISE NOTICE '  - candidate_preferences table created';
    RAISE NOTICE '  - applications table created (with unique constraint)';
    RAISE NOTICE '  - saved_jobs table created';
    RAISE NOTICE '  - resumes storage bucket created (private)';
END $$;
