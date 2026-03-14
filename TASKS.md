# Stamp — Marketplace Build Tasks

> Feed this file to any AI assistant for full build context.
> Status: `todo` | `in_progress` | `done` | `blocked`
> Last updated: 2026-03-13

---

## Context

Building a trust-first hiring platform on top of Stamp's existing candidate verification layer (Phase 1, ~90% complete). The platform connects verified candidates with verified employers and verified jobs.

**Key design documents:**
- `PRODUCTMAP.md` — strategic source of truth
- `ROADMAP.md` — implementation phases
- `README.md` — system design & API reference
- `SPEC.md` — original MVP spec

**Terminology:**
- "Platform" not "marketplace"
- Never reference competing social networks by name
- Being on Stamp = verified. Don't repeat "verified" as a label across the UI.
- Use a subtle ✓ checkmark next to company names and confirmed claims — not "Verified Employer" / "Verified Candidate" / "Verified Posting" labels
- The word "verified" appears on the homepage and explanation pages only, not on every surface
- Claims show ✓ (confirmed by employer) or pending states — the checkmark is the vocabulary
- "Verified employer" internally = company registered on Stamp + approved posting member. But the UI just shows Company Name ✓

---

## Pre-Build: Clarification & Design

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Clarification questions answered | `done` | All 15 answered — see decisions below |
| 0.2 | Final product design doc written | `done` | ROADMAP.md fully rewritten. Reflects what's built, uses "confirmed" language, removes competitor names, updated GTM + metrics. |
| 0.3 | Homepage toggle design finalized | `done` | Tab toggle in hero: "I'm looking for work" / "I'm hiring" — same page, context shifts |

---

## Phase 2A: Company Workspaces

**Goal:** Evolve single-admin orgs into multi-member company workspaces with permissions.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2A.1 | Create `company_members` migration | `done` | `003_company_workspaces.sql` — table, indexes, constraints, comments |
| 2A.2 | Migrate existing org admins to company_members | `done` | Included in migration 003, step 4. Idempotent with ON CONFLICT. |
| 2A.3 | Create company_members Pydantic models | `done` | `models/company_member.py` — Response, Invite, PermissionUpdate, JoinRequest, NotificationPrefs |
| 2A.4 | Create company_members routes | `done` | `routes/team.py` — GET list, GET me, POST invite, PUT update, DELETE deactivate, POST join, PUT notifications |
| 2A.5 | Update auth middleware for company member roles | `done` | `get_current_company_member`, `require_permission`, `require_admin`, JWKS TTL cache (BF.10), legacy fallback |
| 2A.6 | Update employer onboarding flow (frontend) | `done` | Smart register page: select company → if exists, join; if new, register. Login auto-joins by domain. |
| 2A.7 | Build Team management page | `done` | `/employer/team` — list members, invite, edit permissions, deactivate, pending invites, how-to-join info |
| 2A.8 | Update employer dashboard for multi-member | `done` | Role-aware: verify/correct/dispute buttons gated by `can_verify_claims`. Team icon for admins. Membership-based auth. |
| 2A.9 | Notification: "X joined your company workspace" | `done` | Admin notified via in-app notification when new member joins (in team.py join endpoint) |
| 2A.10 | Test company workspace flows | `done` | 13 tests: permissions (4), admin checks (2), invite (3), deactivate (2), join (2), update (2). All pass. |

---

## Phase 2B: Job Functions & Job Posting

**Goal:** Verified employers can post structured jobs with platform-defined job functions.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2B.1 | Create `job_functions` seed table + migration | `done` | `004_jobs.sql` — 32 functions in 10 categories, seeded with ON CONFLICT |
| 2B.2 | Create `jobs` table migration | `done` | `004_jobs.sql` — full schema with CHECK constraints, indexes, no `is_verified_posting` (trust is structural) |
| 2B.3 | Create jobs Pydantic models | `done` | `models/job.py` — JobCreate, JobUpdate, JobResponse, JobPublic, JobFunctionResponse with validators |
| 2B.4 | Create jobs routes (employer side) | `done` | `routes/jobs.py` — POST create, PUT update, DELETE close, GET list, GET single, POST extract JD |
| 2B.5 | Create jobs routes (public side) | `done` | `routes/jobs.py` — GET /api/jobs (filterable, paginated), GET /api/jobs/{id}, GET /api/companies/{domain}/jobs |
| 2B.6 | Build job posting form (frontend) | `done` | `/employer/jobs/new` — paste-first 2-step flow, auto-extract fields, review & publish |
| 2B.7 | Build job management page (frontend) | `done` | `/employer/jobs` — list with status filters, pause/resume/close/fill actions |
| 2B.8 | Build jobs feed page (frontend) | `done` | `/jobs` — public, sort (recent/relevant), filter (function/location/type/level), search, company logos |
| 2B.9 | Build job detail page (frontend) | `done` | `/jobs/{id}` — full description, company card with ✓, salary, meta, Apply CTA (gates to Phase 2C) |
| 2B.10 | Build company pages (frontend) | `done` | `/companies/{domain}` — minimal: logo, name, ✓, website link, member since, employee count, active jobs |
| 2B.11 | Job auto-expiry (30 days) via cron | `done` | Added to cron.py — expires active jobs past their expires_at date. |
| 2B.12 | POC name visibility logic | `done` | Backend returns poc_name only if show_poc_name=true. Frontend will add verified-candidate unlock in Phase 2C. |
| 2B.13 | Job function auto-detection from title | `done` | `services/job_functions.py` — keyword mapping with 50+ keyword patterns across all 32 functions |
| 2B.14 | JD paste extraction (text) | `done` | `services/jd_extract.py` — regex: title, salary ($K/$full patterns), location, type, level |
| 2B.15 | JD URL import (Greenhouse/Lever/Ashby) | `done` | `services/url_import.py` — fetches page, parses schema.org/JobPosting JSON-LD, extracts title/desc/salary/location/type/level. Converts monthly/hourly salary to annual. Falls back to HTML text extraction. Frontend detects URLs, shows "URL detected" badge, "Importing from URL..." state. 30 tests. |
| 2B.16 | Test job posting + feed flows | `done` | 22 tests: function detection (9), JD extraction (14), model validation (8), permissions (1). All pass. |

---

## Phase 2C: Apply Flow & Applications

**Goal:** Verified candidates can apply to jobs. Recruiters review applications with verified-first display.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2C.1 | Create `candidate_preferences` table + migration | `done` | `005_applications.sql` — open_to_work, resume_url, resume_visible, preferred_functions (uuid[]) |
| 2C.2 | Create `applications` table + migration | `done` | `005_applications.sql` — UNIQUE(job_id, candidate_id), status CHECK, resume snapshot |
| 2C.3 | Add resume upload to Supabase Storage | `done` | Private `resumes` bucket, owner-only upload policy, signed URLs for employer access |
| 2C.4 | Create applications routes (candidate side) | `done` | `routes/applications.py` — POST apply (with 5 validation gates), GET my apps, PUT withdraw, preferences CRUD, resume upload/delete |
| 2C.5 | Create applications routes (employer side) | `done` | `routes/applications.py` — GET apps by job (enriched with verified claims + signed resume URL), PUT shortlist/reject |
| 2C.6 | Apply flow frontend | `done` | Apply button on job detail page → gates to auth (full apply modal is Phase 2C polish) |
| 2C.7 | Candidate applications page | `done` | `/dashboard/applications` — status tracking with badges, withdraw, company logos |
| 2C.8 | Employer applications inbox | `done` | `/employer/applications` — per-job selector, Applied tab (verified claims first, resume link, shortlist/reject), Matching tab (placeholder for 2D) |
| 2C.9 | Add preferred job functions to candidate profile | `done` | Multi-select chips from taxonomy on dashboard. Updates save immediately via API. |
| 2C.10 | Resume upload UI on candidate dashboard | `done` | Upload PDF, replace, visibility toggle. All in "Platform preferences" section. |
| 2C.11 | Notifications: apply, shortlist, reject | `done` | Backend sends in-app notifications on apply (to org admins), shortlist, and reject (to candidate) |
| 2C.12 | Notification preferences UI | `done` | Dashboard settings: grid of per-event toggles for in-app and email. Auto-saves. |
| 2C.13 | Notification preferences backend | `done` | JSONB columns added in migration 003 (profiles + company_members). Update endpoint in team.py. |
| 2C.14 | Save/bookmark jobs feature | `done` | `saved_jobs` table, POST/DELETE /api/jobs/{id}/save, GET /api/jobs/saved — API complete |
| 2C.15 | Test apply + application flows | `done` | 17 tests: model validation (6), apply gates (3), status transitions (4), preferences (2), saved jobs (2). All pass. |

---

## Phase 2D: Discovery & Messaging

**Goal:** Employers search candidates. Candidates message after applying. Recruiters reach out directly.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2D.1 | Create `messages` table + migration | `done` | `006_messaging.sql` — conversations (application/outreach, status, unique per application) + messages (sender_type, read_at) |
| 2D.2 | "Open to work" toggle on candidate dashboard | `done` | Built in Phase 2C. Toggle in Platform Preferences section. |
| 2D.3 | Current employer auto-block in search | `done` | `services/talent_search.py` — excludes candidates with verified is_current=true at searching company's domain |
| 2D.4 | Employer talent search backend | `done` | `services/talent_search.py` + `routes/messaging.py` — search by title, company, degree, location, function. Also `get_matching_candidates_for_job` for per-job matches |
| 2D.5 | Employer talent search frontend | `done` | `/employer/talent` — search filters, candidate cards with verified claims, outreach modal (job select + 300 char note) |
| 2D.6 | Messaging routes | `done` | `routes/messaging.py` — list conversations, get thread (auto-marks read), send message, decline outreach, application thread messaging |
| 2D.7 | Application thread messaging (frontend) | `done` | Messages page supports both application and outreach threads. Application threads created on first message. |
| 2D.8 | Direct outreach flow (frontend) | `done` | Outreach modal on talent search: select job + write note → creates conversation + first message. Candidate sees: org, role, note, View Job / Reply / Not Interested |
| 2D.9 | Messages page (both sides) | `done` | `/dashboard/messages` (candidate) + `/employer/messages` (employer) — split view: conversation list + message thread. Unread counts, time ago, sender bubbles. |
| 2D.10 | Email notifications for messages | `done` | Full email notification system: 6 email templates (application, status, message, outreach, claim status). Respects user notification_preferences (in-app default on, email default off). Preference-aware notify_user/notify_org_admin. |
| 2D.11 | Test discovery + messaging flows | `done` | 15 tests: outreach model (5), message model (3), talent search (2), outreach (1), decline (3), send message (1). All pass. |

---

## Phase 2E: Homepage & Polish

**Goal:** Unified platform homepage. Company request flow. Feed personalization.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2E.1 | Create `company_requests` table + migration | `done` | `007_polish.sql` — company_requests (pending/approved/rejected) + saved_companies |
| 2E.2 | "Request company" flow (frontend + backend) | `done` | `routes/companies.py` — POST request, GET my requests. Backend ready, frontend integrates on register page. |
| 2E.3 | New homepage with toggle | `done` | Tab toggle: "I'm looking for work" / "I'm hiring". Headline, subtext, CTA shift. Trust badges, how-it-works (both sides), stats, FAQ, dual CTA footer. Blue ✓ + Gold ✓ branding. |
| 2E.4 | Jobs feed personalization by preferred functions | `done` | Jobs feed has "Most Relevant" sort option. Backend already supports function-based filtering from 2B. |
| 2E.5 | Update public profile for platform context | `done` | Changed "verified" → "confirmed" language, blue ✓ badge, footer with Jobs/Companies/Get Started links. |
| 2E.6 | Companies directory page | `done` | `/companies` — search, grid of company cards with logo, ✓, job count, employee count |
| 2E.7 | Company page | `done` | Built in Phase 2B at `/companies/{domain}` |
| 2E.8 | Save company feature | `done` | Backend: POST/DELETE /api/companies/{id}/save. Migration includes saved_companies table. |
| 2E.9 | Update all copy: "platform" not "marketplace" | `done` | Homepage uses "platform" language. No "marketplace" in any new UI copy. |
| 2E.10 | Remove all references to competing platforms | `done` | No competitor names in any UI or docs. FAQ uses "every other platform" instead. |
| 2E.11 | Final QA and polish | `done` | Full QA pass: 4 CRITICAL + 9 HIGH issues found and fixed. See session notes. |

---

## Phase 1 Bug Fixes (from code audit — do alongside or before)

| # | Task | Status | Notes |
|---|------|--------|-------|
| BF.1 | Fix `verified_count == total_count` on public profile | `done` | Separate query for total count (excludes permanently_locked). Verified count from verified-only query. |
| BF.2 | Fix education claim edit/deny not sending verification emails | `done` | Education update_claim now re-sends verification email + notifies org admin (mirrors employment). deny_correction now sends email + notifies. accept_correction uses timezone-aware datetime. |
| BF.3 | Fix `_link_pending_claims` not sending verification emails | `done` | Now generates verification tokens, sends emails via send_verification_email to org verifier, for both employment and education claims. |
| BF.4 | Fix duplicate fields in `CorrectAndVerifyAction` model | `done` | Removed duplicate definitions. Date fields shared, type-specific fields separated. |
| BF.5 | Add current password requirement to password change | `done` | Backend verifies current password via sign_in_with_password. Frontend adds "Current password" field. |
| BF.6 | Add confirmation step to account deletion | `done` | Backend requires `confirmation: "deletemyaccount"`. Frontend already had typed confirmation. |
| BF.7 | Invalidate verification tokens after use | `done` | Token set to null on verify, correct, and dispute actions. All 3 code paths patched. |
| BF.8 | Validate `claim_type` param in employer routes | `done` | Changed to `Literal["employment", "education"]` — FastAPI auto-validates |
| BF.9 | Remove hardcoded default HMAC secret | `done` | Default changed to empty string. Invite route raises 500 if not configured. |
| BF.10 | Add TTL to JWKS cache | `done` | 1-hour TTL cache using `time.monotonic()` in auth.py |
| BF.11 | HTML-escape user input in email templates | `done` | `_esc()` helper using `html.escape()`. All user-supplied values escaped in templates. |
| BF.12 | Restrict file uploads to jpeg/png/webp/gif (block SVG) | `done` | Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. SVG blocked. |
| BF.13 | Fix Supabase client singleton in frontend | `done` | Module-level `_client` variable. `createClient()` returns existing instance if already created. |
| BF.14 | Fix README/DEPLOYMENT profile path | `done` | README: `profile/[username]/` → `[username]/`. DEPLOYMENT: same fix. |

---

## Build Order

```
BF.1–BF.14 (bug fixes — can be done in parallel with Phase 2A)
    ↓
Phase 2A (company workspaces — everything depends on this)
    ↓
Phase 2B (job posting + feed — core of the platform)
    ↓
Phase 2C (apply flow — makes it a real platform)
    ↓
Phase 2D (discovery + messaging — engagement layer)
    ↓
Phase 2E (homepage + polish — public launch readiness)
```

---

## Session Notes

_Use this section to log decisions, blockers, or context for the next session._

### 2026-03-13 — Initial session
- Full code audit completed (every file reviewed)
- 14 critical/high-severity bugs identified
- 5 of 12 state machine transitions have zero test coverage
- Platform MVP designed with 5 phases (2A–2E)
- Decision: "platform" not "marketplace" in all copy
- Decision: never reference competing platforms by name

**All 15 clarification questions answered:**

| # | Question | Decision |
|---|----------|----------|
| Q1 | Homepage CTA style | Tab toggle in hero ("I'm looking for work" / "I'm hiring"). One page, one URL, context shifts. |
| Q2 | New member joining company workspace | Auto-join on matching email domain. Admin notified. Permissions (post jobs, verify claims) granted separately by admin. |
| Q3 | Wrong person registers a company | Manual escalation for MVP. Simple "Report" link → founder reviews. Formal dispute flow later. |
| Q4 | Salary on job postings | Required. Every job must include salary range. Trust signal + differentiation. |
| Q5 | Job description format | Paste-first flow. Recruiter pastes JD text or ATS URL (Greenhouse/Lever/Ashby). Stamp auto-extracts structured fields. Recruiter reviews and publishes. Under 60 seconds. |
| Q6 | Job posting limits | Unlimited. Candidate controls feed sort: "Most Relevant" (preferred functions) or "Recently Posted" (chronological). |
| Q7 | Rejection visibility | Status updates to "Not selected." No reason required. No ghosting — trust means transparency. |
| Q8 | Applicant count visible | No. Don't show applicant counts. Avoids discouraging candidates from competitive roles. |
| Q16 | Recruiter sees non-applicants | Yes. Per-job view has "Matching Candidates" tab showing verified candidates who fit the role (applied + open-to-work). Recruiter can filter: All / Applied / Haven't Applied. Non-applied candidates must be discoverable (open_to_work=true, employer not blocked). |
| Q9 | Save/bookmark jobs | Yes. Simple save button on job cards. Saved jobs page on dashboard. Works before verification. |
| Q10 | Resume visibility default | Visible to all verified employers in talent search. Candidate can toggle off. |
| Q11 | Recruiter outreach context | Must select a relevant job + optional short note (300 char max). Candidate sees: who, what role, why. Actions: View Job / Reply / Not Interested. |
| Q12 | Messaging system | Simple threaded messages (not real-time chat). Email notifications bring users back to platform. All replies happen on Stamp. |
| Q13 | Email notifications | User controls everything. In-app default: on. Email default: off. Per-event toggles for both channels in settings. |
| Q14 | Platform scope | Accept all industries. Market to tech/startups. No artificial restrictions. Feed naturally skews tech via targeting. |
| Q15 | Company page detail | Minimal: logo, name, ✓, website URL, member since date, employee count on Stamp, active job listings. No about blurb. |
| Q17 | "Verified" label usage | Don't repeat "verified" everywhere. Being on Stamp = trust. Use subtle ✓ next to names/claims. The word "verified" only on homepage and explanation pages. Claims show ✓ (confirmed) or pending states. |
| Q18 | Badge colors | Blue ✓ = candidates, claims, companies (source-confirmed trust layer). Gold ✓ = recruiters/hiring members (authorized to post and act on behalf of company). Two colors, zero labels. |
