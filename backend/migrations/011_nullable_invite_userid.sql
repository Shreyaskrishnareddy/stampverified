-- ============================================================================
-- Migration 011: Make user_id nullable on company_members for invites
-- ============================================================================
-- Invited members don't have a Supabase auth account yet. The user_id
-- is filled when they sign up and join the workspace. Until then it's NULL.
--
-- Also drops the unique constraint on (organization_id, user_id) since
-- multiple invited members can have NULL user_id. The email uniqueness
-- constraint is sufficient.
-- ============================================================================

-- Drop the NOT NULL constraint
ALTER TABLE company_members
    ALTER COLUMN user_id DROP NOT NULL;

-- Drop the old unique constraint that includes user_id
ALTER TABLE company_members
    DROP CONSTRAINT IF EXISTS uq_company_members_org_user;

DO $$
BEGIN
    RAISE NOTICE 'Migration 011 complete: company_members.user_id is now nullable for invited members';
END $$;
