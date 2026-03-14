-- ============================================================================
-- Migration 006: Conversations & Messages
-- ============================================================================
-- Adds the messaging system for application threads and direct outreach.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DEPENDS ON: 005_applications.sql
--
-- What this does:
--   1. Creates `conversations` table (application threads + outreach)
--   2. Creates `messages` table (individual messages within conversations)
--   3. Creates indexes for performance
-- ============================================================================


-- ============================================================================
-- STEP 1: Create `conversations` table
-- ============================================================================
-- A conversation is either:
--   - An application thread (candidate applied, both sides can message)
--   - A direct outreach (recruiter reached out about a specific job)
--
-- Key design decisions:
--   - Application threads are created on FIRST MESSAGE, not on apply.
--   - Outreach creates conversation + first message atomically.
--   - "Not Interested" sets status to 'declined' — no further messages.
--   - Each conversation links one candidate to one company member.
--   - updated_at tracks the last message for sorting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation type
    type VARCHAR(20) NOT NULL CHECK (type IN ('application', 'outreach')),

    -- For application threads: links to the application
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,

    -- For outreach: which job the recruiter is reaching out about
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- Participants
    candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    company_member_id UUID NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'declined')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One conversation per application
    CONSTRAINT uq_conversations_application UNIQUE(application_id)
);

-- Candidate's conversations (my messages page)
CREATE INDEX IF NOT EXISTS idx_conversations_candidate
    ON conversations(candidate_id, updated_at DESC);

-- Company member's conversations (employer messages page)
CREATE INDEX IF NOT EXISTS idx_conversations_member
    ON conversations(company_member_id, updated_at DESC);

-- Org's conversations (all conversations for a company)
CREATE INDEX IF NOT EXISTS idx_conversations_org
    ON conversations(organization_id);

COMMENT ON TABLE conversations IS 'Messaging threads between candidates and company members. Two types: application threads and direct outreach.';
COMMENT ON COLUMN conversations.type IS 'application = tied to a job application, outreach = recruiter reached out directly.';
COMMENT ON COLUMN conversations.status IS 'active = open for messages, declined = candidate said "Not Interested" — no further messages.';


-- ============================================================================
-- STEP 2: Create `messages` table
-- ============================================================================
-- Individual messages within a conversation. Simple threaded model.
-- No real-time (WebSockets) for MVP — async with email notifications.
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which conversation
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Who sent it
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('candidate', 'employer')),
    sender_id UUID NOT NULL,  -- user_id for candidates, company_member_id for employers

    -- Content
    content TEXT NOT NULL,

    -- Timestamps
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ  -- null = unread
);

-- Messages in a conversation (ordered by time)
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, sent_at);

-- Unread messages for a participant
CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages(conversation_id, read_at) WHERE read_at IS NULL;

COMMENT ON TABLE messages IS 'Individual messages within conversations. Async model — no real-time for MVP.';
COMMENT ON COLUMN messages.sender_type IS 'candidate or employer. Used to determine which side sent the message.';
COMMENT ON COLUMN messages.read_at IS 'Null = unread by the other party. Set when the recipient views the conversation.';


-- ============================================================================
-- STEP 3: Log
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 006 complete:';
    RAISE NOTICE '  - conversations table created';
    RAISE NOTICE '  - messages table created';
END $$;
