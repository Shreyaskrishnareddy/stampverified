-- ============================================================================
-- Migration 004: Job Functions & Job Posting
-- ============================================================================
-- Adds the job functions taxonomy and the jobs table for the hiring platform.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: 003_company_workspaces.sql
--
-- What this does:
--   1. Creates the `job_functions` taxonomy table with seed data (~30 functions)
--   2. Creates the `jobs` table (job postings by company members)
--   3. Creates indexes for performance
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `job_functions` taxonomy table
-- ============================================================================
-- Platform-defined job function categories. These power:
--   - Candidate preferred functions (matching)
--   - Jobs feed filtering and sort
--   - Auto-detection from job titles
--
-- Candidates never see "job_function_id" — it's an internal classification.
-- Recruiters never pick a function — it's auto-detected from the job title.
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE job_functions IS 'Platform-defined job function taxonomy. Powers matching, filtering, and auto-categorization.';
COMMENT ON COLUMN job_functions.slug IS 'URL-safe identifier (e.g., software-engineering). Used in API filters.';
COMMENT ON COLUMN job_functions.category IS 'Grouping for display (e.g., Engineering, Product, Design).';
COMMENT ON COLUMN job_functions.sort_order IS 'Display ordering within category.';


-- Seed data: ~30 functions across 10 categories (tech/startup wedge)
INSERT INTO job_functions (name, slug, category, sort_order) VALUES
    -- Engineering (1xx)
    ('Software Engineering',      'software-engineering',      'Engineering', 100),
    ('Frontend Engineering',      'frontend-engineering',      'Engineering', 101),
    ('Backend Engineering',       'backend-engineering',       'Engineering', 102),
    ('Full Stack Engineering',    'full-stack-engineering',    'Engineering', 103),
    ('Mobile Engineering',        'mobile-engineering',        'Engineering', 104),
    ('DevOps & Infrastructure',   'devops-infrastructure',     'Engineering', 105),
    ('Data Engineering',          'data-engineering',          'Engineering', 106),
    ('Machine Learning & AI',     'machine-learning-ai',       'Engineering', 107),
    ('QA & Testing',              'qa-testing',                'Engineering', 108),
    ('Security Engineering',      'security-engineering',      'Engineering', 109),

    -- Product (2xx)
    ('Product Management',        'product-management',        'Product',     200),
    ('Technical Program Management', 'technical-program-management', 'Product', 201),

    -- Design (3xx)
    ('Product Design',            'product-design',            'Design',      300),
    ('UX Research',               'ux-research',               'Design',      301),
    ('Brand & Visual Design',     'brand-visual-design',       'Design',      302),

    -- Data (4xx)
    ('Data Science',              'data-science',              'Data',        400),
    ('Data Analytics',            'data-analytics',            'Data',        401),

    -- Business (5xx)
    ('Sales',                     'sales',                     'Business',    500),
    ('Business Development',      'business-development',      'Business',    501),
    ('Account Management',        'account-management',        'Business',    502),
    ('Customer Success',          'customer-success',          'Business',    503),

    -- Marketing (6xx)
    ('Marketing',                 'marketing',                 'Marketing',   600),
    ('Growth',                    'growth',                    'Marketing',   601),
    ('Content',                   'content',                   'Marketing',   602),

    -- Operations (7xx)
    ('Operations',                'operations',                'Operations',  700),
    ('Strategy',                  'strategy',                  'Operations',  701),
    ('Project Management',        'project-management',        'Operations',  702),

    -- Finance (8xx)
    ('Finance',                   'finance',                   'Finance',     800),
    ('Accounting',                'accounting',                'Finance',     801),

    -- People (9xx)
    ('HR & People Operations',    'hr-people-operations',      'People',      900),
    ('Recruiting',                'recruiting',                'People',      901),

    -- Legal (10xx)
    ('Legal',                     'legal',                     'Legal',       1000),
    ('Compliance',                'compliance',                'Legal',       1001)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- STEP 2: Create `jobs` table
-- ============================================================================
-- Every job posting on the platform. Tied to a verified organization and
-- posted by an approved company member.
--
-- Key design decisions:
--   - No `is_verified_posting` column. Being on the platform IS the trust
--     signal. Every job here is from a registered company, posted by an
--     approved member. The trust is structural, not a flag.
--   - `job_function_id` is auto-detected from the title. The recruiter never
--     picks it. It powers feed filtering and candidate matching internally.
--   - `salary_min` and `salary_max` are REQUIRED (enforced at app layer).
--     Pay transparency is a core trust signal.
--   - `poc_member_id` can become NULL if the POC member is deactivated.
--     The job stays visible; frontend falls back to showing company name.
--   - `posted_by` can become NULL if the poster is deactivated.
--     The job stays visible with the company name.
--   - Description is stored as plain text. Rendered with basic markdown
--     formatting on the frontend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which company posted this job
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Who posted it (company member with can_post_jobs permission)
    posted_by UUID REFERENCES company_members(id) ON DELETE SET NULL,

    -- Internal point of contact for this role (may differ from poster)
    poc_member_id UUID REFERENCES company_members(id) ON DELETE SET NULL,

    -- Job details
    title VARCHAR(255) NOT NULL,
    job_function_id UUID REFERENCES job_functions(id) ON DELETE SET NULL,
    description TEXT NOT NULL,

    -- Location
    location VARCHAR(255),
    location_type VARCHAR(20) NOT NULL DEFAULT 'onsite'
        CHECK (location_type IN ('remote', 'hybrid', 'onsite')),

    -- Classification
    employment_type VARCHAR(20) NOT NULL DEFAULT 'full_time'
        CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
    experience_level VARCHAR(20) NOT NULL DEFAULT 'mid'
        CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'executive')),

    -- Compensation (required — pay transparency is a trust signal)
    salary_min INTEGER NOT NULL,
    salary_max INTEGER NOT NULL,
    salary_currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Visibility controls
    show_poc_name BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'paused', 'closed', 'filled')),
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Salary sanity check
    CONSTRAINT chk_salary_range CHECK (salary_max >= salary_min),
    CONSTRAINT chk_salary_positive CHECK (salary_min >= 0)
);

-- Jobs by organization (company page: list jobs for a company)
CREATE INDEX IF NOT EXISTS idx_jobs_org_id
    ON jobs(organization_id);

-- Active jobs feed (public jobs page, sorted by posted_at)
CREATE INDEX IF NOT EXISTS idx_jobs_active
    ON jobs(status, posted_at DESC) WHERE status = 'active';

-- Jobs by function (feed filtering by job function)
CREATE INDEX IF NOT EXISTS idx_jobs_function
    ON jobs(job_function_id) WHERE status = 'active';

-- Jobs by poster (my posted jobs in employer dashboard)
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by
    ON jobs(posted_by);

-- Expiry check (cron job finding expired jobs)
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at
    ON jobs(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

COMMENT ON TABLE jobs IS 'Job postings by verified company members. Every job is from a registered company — the trust is structural.';
COMMENT ON COLUMN jobs.job_function_id IS 'Auto-detected from title. Powers feed filtering and candidate matching. Recruiter never picks this.';
COMMENT ON COLUMN jobs.salary_min IS 'Minimum salary in the specified currency. Required — pay transparency is a trust signal.';
COMMENT ON COLUMN jobs.show_poc_name IS 'Whether the POC name is shown publicly. If false, shows company name only. Candidates with confirmed claims always see POC name.';
COMMENT ON COLUMN jobs.status IS 'draft = not published, active = visible in feed, paused = temporarily hidden, closed = manually ended, filled = position filled.';


-- ============================================================================
-- STEP 3: Log migration results
-- ============================================================================

DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count FROM job_functions;
    RAISE NOTICE 'Migration 004 complete:';
    RAISE NOTICE '  - job_functions table created with % seed entries', func_count;
    RAISE NOTICE '  - jobs table created';
END $$;
