-- ============================================================================
-- Migration 008: Update delete_user_account() for new tables
-- ============================================================================
-- The original function only deleted from notifications, claims, and profiles.
-- Now we also need to delete from: messages, conversations, applications,
-- saved_jobs, saved_companies, candidate_preferences, company_members.
--
-- CASCADE handles most of these via profiles FK, but explicit deletion
-- ensures clean ordering and handles company_members (which references
-- auth.users, not profiles).
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

    -- Delete profile (must be last — other FKs reference it)
    DELETE FROM profiles WHERE id = target_user_id;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE 'Migration 008 complete: delete_user_account() updated for all tables';
END $$;
