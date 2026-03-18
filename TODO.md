# Stamp — Master TODO List

> Complete list of issues, improvements, and features identified across all audits.
> Feed this file to any AI assistant for full context on what needs to be done.
> Last updated: 2026-03-17

---

## How to Use This File

Status: `todo` | `in_progress` | `done` | `skip`
Priority: `P0` (security + first impression killers) | `P1` (trust + conversion blockers) | `P2` (polish) | `P3` (future)

See also: `VERIFICATION_TODO.md` for detailed architecture and rationale behind trust/security items.

---

## P0 — Security + First Impression Killers

Fix before any outreach. Security items from verification audit included here.

| # | Issue | Details | Status |
|---|-------|---------|--------|
| P0.1 | **CRITICAL: Anyone can register any domain** | Attacker registers `google.com`, becomes admin, verifies fake claims. Require registrant's email domain to match org domain. (`routes/team.py`, org creation) | `done` |
| P0.2 | **CRITICAL: Remove legacy admin_email fallback** | If attacker gets auth account with email matching org's `admin_email`, they auto-become admin. Delete lines 120-163 in `middleware/auth.py`. | `done` |
| P0.3 | **CRITICAL: Self-join = auto-admin if first** | First person from `@company.com` to self-join becomes admin with all permissions. Require admin approval for self-join; domain match creates `status=pending`. (`routes/team.py:293-428`) | `done` |
| P0.4 | **Block public email domain org registration** | Nobody should register `gmail.com` or `yahoo.com` as their company. Add blocklist of public email domains. | `done` |
| P0.5 | **Add 30-day TTL to verification tokens** | Tokens never expire. Leaked token valid forever. Add `token_expires_at` column, check in `routes/verify.py`. | `done` |
| P0.6 | **Invalidate old tokens on re-submission** | When candidate re-edits after dispute, old token not explicitly killed. Set old `verification_token = NULL` before generating new one. (`routes/claims.py:250`) | `done` |
| P0.7 | **Enforce `is_domain_verified` for sensitive actions** | Field exists but never checked. Unverified orgs should NOT be able to: post Gold jobs, verify claims, appear in company directory. | `done` |
| P0.8 | **Remove public debug endpoint** | `/api/jobs/match/debug` exposes API key info in production. Remove immediately. | `done` |
| P0.9 | **Sanitize `next` param on redirects** | `/?auth=signup&next=https://evil.com` could redirect to malicious sites. Validate `next` starts with `/` and has no `//`. | `done` |
| P0.10 | Stamp Jobs tab shows 0 jobs as default | First click on "Jobs" = empty page. Default to Internet Jobs tab when Stamp Jobs count is 0. | `done` |
| P0.11 | "Verified" vs "confirmed" used interchangeably | Pick ONE word and use it everywhere across profile, landing page, dashboard. | `done` |
| P0.12 | No privacy policy or terms of service | Platform handling employment data with zero legal pages. Need Privacy Policy + Terms of Service. | `todo` |
| P0.13 | JSearch API timeout on Render free tier | 10-second timeout too short. Increase to 30 seconds. Resume matching (the hook) fails silently. | `todo` |
| P0.14 | **Dead end when both Stamp and external jobs return empty** | User uploads resume, gets 0 results, no explanation. Need distinct empty states. | `done` |
| P0.15 | **Backend `notice` not rendered on frontend** | When JSearch quota exhausted, backend returns `notice` but frontend ignores it. Silent failure. | `done` |

---

## P1 — Trust + Conversion Blockers

These prevent users from completing key actions or weaken the trust model.

| # | Issue | Details | Status |
|---|-------|---------|--------|
| P1.1 | **Send invitation emails** | Admin creates invite but invitee never notified. Wire up Resend email on invite. (`routes/team.py:149`) | `done` |
| P1.2 | **Require Supabase email verification for workspace join** | Unverified emails can join workspaces via domain match. Check `email_confirmed_at IS NOT NULL`. | `done` |
| P1.3 | **Add 30-day invitation expiry** | Invite records live forever with `status=invited`. Auto-expire after 30 days. | `todo` |
| P1.4 | **Rate limit outreach (10/day per member)** | Any member with `can_post_jobs` can message unlimited candidates. Add daily cap. | `done` |
| P1.5 | **Show correction diff before acceptance** | Candidate accepts org corrections blindly. Show side-by-side diff before accepting. (`routes/claims.py:312-365`) | `done` |
| P1.6 | **Contested domain handling** | If someone tries to register a domain already taken, show "This company is already on Stamp. Request to join instead." | `todo` |
| P1.7 | **Per-user claim rate limit (10 pending)** | No limit on pending claims. Add max 10 pending claims per user to prevent claim farming. | `done` |
| P1.8 | **Subdomain normalization** | `mail.google.com` doesn't match `google.com`. Normalize to root domain for matching. | `done` |
| P1.9 | **Create audit_logs table** | Zero audit trail. Create table: `actor_id`, `action`, `resource_type`, `resource_id`, `metadata`, `ip_address`, `created_at`. | `done` |
| P1.10 | **Log all verification actions** | Every verify/correct/dispute writes to audit_logs. Who did it, when, what changed. | `done` |
| P1.11 | **Log all permission changes** | Admin grants/revokes permissions, member joins/leaves → audit log. | `done` |
| P1.12 | Allow any role at company domain for registration | `founder@startup.com` gets rejected. Accept any `@company.com` email, not just role-based (hr@, people@). Reconciles with P0.1: match domain, accept any role. | `todo` |
| P1.13 | **`from=match` context lost for first-time users** | Banner only shows when profile exists. Show context during profile creation. | `done` |
| P1.14 | **Double-counted rate limit** | Rate limit checks in both `job_search.py` and `job_match.py`. One upload burns two slots. Check once at route level. | `todo` |
| P1.15 | **"Get Verified" CTA doesn't connect to job matching** | Should say "Stand out when you apply — get your experience verified." | `done` |
| P1.16 | Company not in Clearbit = dead end for candidates | Need "Can't find your company? Enter details manually" fallback. | `todo` |
| P1.17 | No "View public profile" button on dashboard | Users don't know what their profile looks like. | `todo` |
| P1.18 | "Internet Jobs" naming is confusing | Rename to "Job Matcher" or "AI Job Match". | `todo` |
| P1.19 | No terms checkbox on signup | Legal requirement. Add "By signing up you agree to our Terms and Privacy Policy". | `todo` |
| P1.20 | Apply flow doesn't enforce 1-verified-claim on frontend | Backend enforces but frontend shows confusing error. Add frontend check. | `todo` |
| P1.21 | Register page: verification email fallback contradicts validation | Empty defaults to user's email, fails role-based validation. Fix or clarify. | `todo` |
| P1.22 | No step indicator on employer registration | Add progress indicator. | `todo` |
| P1.23 | Job description renders as plain text | Need markdown rendering on job detail page. | `todo` |
| P1.24 | Salary field doesn't specify period | Add period selector: annual/monthly/hourly. | `todo` |
| P1.25 | No social proof anywhere | Add "Launching 2026" badge or early user count when available. | `todo` |

---

## P2 — Polish

These don't block users but make the product feel unfinished.

| # | Issue | Details | Status |
|---|-------|---------|--------|
| P2.1 | No "Companies" link in desktop navbar | Only in mobile hamburger. Inconsistent. | `todo` |
| P2.2 | No share button on job detail page | Standard on every job board. | `todo` |
| P2.3 | Messages use `alert()` for errors | Replace with toast notifications. | `todo` |
| P2.4 | No "View public profile" link for employers viewing candidates | Can't click through to full profile from applications page. | `todo` |
| P2.5 | Employer dashboard org_type shows raw text | "company" should be "Company". | `todo` |
| P2.6 | No confirmation before rejection | Clicking "Reject" is instant and irreversible. Add confirmation dialog. | `todo` |
| P2.7 | No "Already contacted" indicator in talent search | Recruiter can't tell if they've already reached out. | `todo` |
| P2.8 | Education correction form too structured | Simplify for education claims. | `todo` |
| P2.9 | Selected domain overlaps company name in autocomplete | Move domain below if name is long. | `todo` |
| P2.10 | No "Why am I receiving this?" on verification page | Add expandable explanation for verifiers. | `todo` |
| P2.11 | No token expiration notice on verification page | Frontend counterpart to P0.5. Show "This link expires in 30 days." | `todo` |
| P2.12 | Conversation list doesn't label "Application" type | Outreach shows label, applications don't. Inconsistent. | `todo` |
| P2.13 | "Upload Resume" in mobile menu but not desktop nav | Inconsistent navigation. | `todo` |
| P2.14 | No "Report this listing" on job detail | Trust platform should let users flag suspicious postings. | `todo` |
| P2.15 | For-employers page toggle adds cognitive load | User already chose "For Employers." Consider removing toggle. | `todo` |
| P2.16 | No company description field | Just logo + name + jobs. Add optional 500-char about section. (Also in VERIFICATION_TODO CO.T8) | `todo` |
| P2.17 | Google favicon logos sometimes low quality | Blurry or wrong fallback logos. | `todo` |
| P2.18 | Auto-joining workspace gives zero permissions | Confusing first experience. Now gated by P0.3 (admin approval), but approved members should get view permissions. | `todo` |
| P2.19 | No "Last active" on team members list | Admin can't see when members last logged in. | `todo` |
| P2.20 | No preview step before publishing a job | Goes from editing to live with no preview. | `todo` |
| P2.21 | **Log all job lifecycle events** | Job created/published/paused/closed/filled → audit log with actor. | `todo` |
| P2.22 | **Dispute cooldown for orgs** | After 3 disputes on same claim, require 7-day cooldown. Prevents griefing. | `todo` |
| P2.23 | **Structured dispute reasons** | Dropdown: "Never employed here", "Dates incorrect", "Title incorrect", "Other" + optional text. | `todo` |
| P2.24 | **Recruiter activity log** | Track: jobs posted, claims verified, outreach sent. Visible to admin. | `todo` |
| P2.25 | **Employment type field on claims** | Full-time, part-time, contract, intern. Displayed on claim card. | `todo` |

---

## P3 — Future Features

Not needed for launch but important for growth.

| # | Issue | Details | Status |
|---|-------|---------|--------|
| P3.1 | Saved jobs page on frontend | Backend exists but no frontend page. | `todo` |
| P3.2 | Similar jobs on job detail page | Dead end after reading a job. | `todo` |
| P3.3 | Application status filters | Can't filter "Show only shortlisted". | `todo` |
| P3.4 | Real-time messaging (WebSocket or polling) | Messages don't update without refresh. | `todo` |
| P3.5 | Candidate notes for employers | Can't annotate applications. | `todo` |
| P3.6 | Bulk verification for employers | 20 pending claims = 20 individual clicks. Add "Verify all". | `todo` |
| P3.7 | Sidebar navigation | Navbar dropdown won't scale. | `todo` |
| P3.8 | Debounce on jobs search | Every keystroke triggers API call. Add 300ms debounce. | `todo` |
| P3.9 | Postgres full-text search for jobs | Current text search only filters first page. | `todo` |
| P3.10 | N+1 query optimization | Employer dashboard, applications, conversations have N+1 patterns. | `todo` |
| P3.11 | Org-wide conversations | Team members can't see each other's outreach threads. | `todo` |
| P3.12 | Closed job applications still accessible | Can't review old applications. | `todo` |
| P3.13 | Reopen/reactivate closed jobs | No UI button. Backend supports it. | `todo` |
| P3.14 | Integrate with Finch/Merge APIs | Programmatic verification instead of email-based. | `todo` |
| P3.15 | "Sign in with Stamp" for third-party integrations | OAuth provider for other platforms. | `todo` |
| P3.16 | Recruiter seats pricing | $49-99/month for verified talent search. | `todo` |
| P3.17 | B2B verification API | $0.50-2/query for instant employment verification. | `todo` |
| P3.18 | HRIS integrations (Workday, BambooHR, Gusto) | Direct data connections instead of email. | `todo` |
| P3.19 | FCRA compliance review | Required before selling verification data. | `todo` |
| P3.20 | Error monitoring (Sentry) | No production error tracking. | `todo` |
| P3.21 | Contact/message button on public profiles | Visitors can't reach person through Stamp. | `todo` |
| P3.22 | File sharing in messages | Can't send attachments. | `todo` |
| P3.23 | Application export (CSV download for employers) | No way to export applicant data. | `todo` |
| P3.24 | Advanced talent search filters | Years of experience, education level, skills. | `todo` |
| P3.25 | Pagination on all list pages | Jobs, companies, applications, conversations all lack pagination. | `todo` |
| P3.26 | **Progressive verification tiers** | Tier 1: email match (auto). Tier 2: verifier inbox. Tier 3: DNS TXT record. Display tier on company profile. | `todo` |
| P3.27 | **DNS TXT verification flow** | "Add TXT record `stamp-verify=abc123` to your domain." Premium trust layer for Gold badge. | `todo` |
| P3.28 | **Admin-visible audit dashboard** | Frontend page for org admins to view workspace activity log. | `todo` |
| P3.29 | **Hiring manager role** | Can view applications and message candidates but cannot post jobs or verify claims. | `todo` |
| P3.30 | **Staffing agency dual claims** | "Contractor at Google via Randstad." Verify with both orgs. | `todo` |
| P3.31 | **Dead company handling** | "Company no longer active" status. Allow candidate self-attestation with flag. | `todo` |
| P3.32 | **Domain alias table** | Facebook → Meta. Old domain maps to new org. | `todo` |
| P3.33 | **Verification age/freshness display** | Claim verified last week is stronger signal than 2 years ago. Show on profile. | `todo` |
| P3.34 | **Candidate "Block company" feature** | Candidate can block specific companies from seeing profile or sending outreach. | `todo` |
| P3.35 | **Domain fuzzy matching / suggestions** | When domain doesn't match any org, suggest close matches: "Did you mean stanford.edu?" | `todo` |

---

## Testing — Resume Matching Feature

| # | Test | Details | Status |
|---|------|---------|--------|
| T.1 | Rate limit behavior | Verify 16th request in 1 hour returns 429. Counter resets after window. | `todo` |
| T.2 | Cache hit behavior | Same query+location within 1 hour returns cached results. Different query bypasses. | `todo` |
| T.3 | Quota exhaustion behavior | After 450 calls, returns empty gracefully with `notice` field. | `todo` |
| T.4 | `/api/jobs/match` route behavior | PDF upload → parse → search → response shape. Invalid PDF → error. Non-PDF → 400. Over 5MB → 400. | `todo` |
| T.5 | Resume quality validation | Junk PDF → rejected before API call. Valid resume with 1 title → accepted. | `todo` |
| T.6 | Stamp jobs vs external ordering | Stamp jobs always before external jobs in response. | `todo` |

Frontend verification checklist (manual):

| # | Check | Details | Status |
|---|-------|---------|--------|
| TC.1 | Logged-out CTA goes to signup | "Get Verified" → `/?auth=signup&next=/dashboard?from=match` | `todo` |
| TC.2 | Logged-in CTA goes to dashboard | "Get Verified" → `/dashboard?from=match` | `todo` |
| TC.3 | `from=match` banner renders | Dashboard shows context banner when `?from=match` | `todo` |
| TC.4 | Quota notice renders | Frontend shows explanation when backend returns `notice` | `todo` |
| TC.5 | Empty state: 0 Stamp + 0 external | Helpful message, not blank page | `todo` |
| TC.6 | Empty state: weak match | "We found limited matches. Try a different resume." | `todo` |

---

## Operational / IP

| # | Item | Details | Status |
|---|------|---------|--------|
| OP.1 | Make GitHub repo private | Trade secrets publicly visible. | `todo` |
| OP.2 | File trademarks | "Stamp" and "StampVerified" ~$500 at USPTO. | `todo` |
| OP.3 | Get first 5 real verified profiles | Phase 1 exit criteria. | `todo` |
| OP.4 | Apply to YC S26 | Deadline: May 4, 2026. Application drafted. Need founder video. | `in_progress` |
| OP.5 | Set up Sentry or error monitoring | No production error tracking. | `todo` |
| OP.6 | Upgrade Render to paid tier | $7/month removes cold starts. | `todo` |

---

## Completed (2026-03-13 to 2026-03-17)

- Full platform: 5 phases (2A-2E), 8 migrations, 25+ backend files, 30+ frontend pages
- Resume-to-jobs matching (JSearch API integration with caching, rate limiting, quota guardrails)
- Resume parser (keyword-based, 32 tests)
- Domain-first company search with gold badge
- Duration verification (calculated duration shown to verifiers)
- Smart employer registration (join vs register flow)
- Paste-first job posting with ATS URL import (Greenhouse/Lever/Ashby JSON-LD)
- Talent search with current employer auto-blocking
- Messaging (application threads + outreach with decline)
- Email notifications (6 templates, preference-aware)
- 30 bug fixes across 3 QA passes
- 173 tests passing
- Vercel Analytics integration
- Full verification architecture audit → `VERIFICATION_TODO.md`
- YC S26 application drafted
- Documentation updated (README, ROADMAP, TASKS, TODO, VERIFICATION_TODO)

---

## Session Context for Next Conversation

- **Product:** stampverified.com — verified professional identity platform
- **Stack:** FastAPI + Next.js 16 + Supabase + Resend + JSearch API
- **Stage:** Live product, pre-users, pre-revenue. Cold start phase.
- **Founder:** Shreyas Krishnareddy, solo founder, graduated May 2025
- **Key files:** TASKS.md (build history), ROADMAP.md (product plan), VERIFICATION_TODO.md (trust architecture), this file (TODO)
- **GitHub:** github.com/Shreyaskrishnareddy/stampverified
- **Badge system:** Blue check = candidates/claims, Gold check = companies/hiring teams
- **Tagline:** "Your career. Verified."
- **Key decision:** Verification is the product. Resume matching is the hook.
- **Trust model:** Progressive — email match → verifier inbox → DNS verification. DNS is NOT a gate, it's a premium trust upgrade.

---

## What 9/10 Feels Like

A user uploads a resume, sees useful jobs, understands the difference between
web jobs and Stamp jobs, signs up smoothly, lands in the right place, understands
exactly what to do next, and never hits a confusing or suspicious edge case.

**The gap from current state to 9/10:**

1. Fix P0.1-P0.9 security items (trust foundation, ~12 hours)
2. Fix the dead-end when both Stamp and external jobs return empty (UX, 30 min)
3. Preserve `from=match` context through profile creation (conversion, 1 hr)
4. Render quota/notice states and explain when external jobs are unavailable (trust, 30 min)
5. Rewrite "Get Verified" CTA to connect job matching → verification → stronger applications (product, 15 min)

These changes turn "clever feature" into "trustworthy product."
