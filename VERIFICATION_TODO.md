# Stamp — Verification Architecture TODO

> Audit-driven plan for hardening candidate, company, and recruiter trust.
> Based on full code audit of backend/app/ on 2026-03-17.
> Feed this file to any AI assistant for full context.

---

## 1. Candidate Verification

### Current Flow
1. Candidate creates employment/education claim with company domain (e.g. `google.com`)
2. System looks up org by domain in `organizations` table (`routes/claims.py:50-61`)
3. If org exists: status → `awaiting_verification`, email sent to org's `verifier_email` with `secrets.token_urlsafe(32)` token
4. If org doesn't exist: status → `awaiting_org` (dead end until someone registers that org)
5. Verifier clicks link → `/verify/{token}` → can verify, correct, or dispute without logging in
6. After 5 disputes on same claim, it's permanently locked (`routes/employer.py:194-211`)
7. Candidate needs 1 verified claim (employment OR education) to apply to jobs

### Problems / Gaps

| # | Issue | Severity | File | Line |
|---|-------|----------|------|------|
| CV.1 | **No token TTL** — verification tokens never expire. Leaked token valid forever until claim is verified. | HIGH | `routes/claims.py` | token generation |
| CV.2 | **Token not invalidated on re-edit** — when candidate edits after dispute, new token generated but old one not explicitly killed | MEDIUM | `routes/claims.py:250` | — |
| CV.3 | **1 verified claim is a low trust bar** — a 20-year-old education claim satisfies the "verified" requirement for job applications | MEDIUM | `routes/applications.py` | apply validation |
| CV.4 | **Candidate can claim any company/title** — no pre-check. "CEO at Google" sits in `awaiting_verification` looking semi-legitimate | LOW | `routes/claims.py` | claim creation |
| CV.5 | **Correction acceptance is blind** — user accepts org corrections without seeing what changed | MEDIUM | `routes/claims.py:312-365` | accept-correction |
| CV.6 | **5-dispute lock can grief legitimate claims** — org can dispute 5x with minor edits to permanently lock a real claim | MEDIUM | `routes/employer.py:194-211` | — |
| CV.7 | **Domain typo = permanent limbo** — `standford.edu` instead of `stanford.edu` means claim never gets verified | LOW | `routes/claims.py:50-61` | domain lookup |
| CV.8 | **Dispute reason is unstructured** — free text, no evidence, no categories | LOW | `routes/employer.py:231` | — |

### TODOs

| # | Task | Priority | Details |
|---|------|----------|---------|
| CV.T1 | Add 30-day TTL to verification tokens | P0 | Add `token_expires_at` column to claims table. Check expiry in `routes/verify.py`. Return "expired" page with re-request option. |
| CV.T2 | Invalidate old tokens on re-submission | P0 | When candidate re-edits claim after dispute, set old `verification_token = NULL` before generating new one. |
| CV.T3 | Show correction diff before acceptance | P1 | In `routes/claims.py` accept-correction endpoint, return proposed changes. Frontend shows side-by-side diff. User explicitly accepts. |
| CV.T4 | Add domain fuzzy matching / suggestions | P2 | When domain doesn't match any org, suggest close matches (Levenshtein). "Did you mean stanford.edu?" |
| CV.T5 | Dispute cooldown for orgs | P2 | After 3 disputes on same claim, require admin review or 7-day cooldown before next dispute. Prevents griefing. |
| CV.T6 | Structured dispute reasons | P2 | Dropdown: "Never employed here", "Dates incorrect", "Title incorrect", "Other" + optional free text. |
| CV.T7 | Tiered verification strength | P3 | Show verification "age" — a claim verified last week is stronger than one verified 2 years ago. Display on profile. |

### Long-term Target State
- Claims are source-verified, not self-reported. This is already the model — keep it.
- Token-based verification (no login required) is the moat. Keep it, but add TTL and one-time-use semantics.
- Future: Integrate Finch/Merge APIs for programmatic verification (skip email entirely for companies with HRIS).
- Future: Allow candidates to provide role-based HR email (hr@company.com, people@company.com) with guardrails. This is the highest-leverage product change for cold start.

---

## 2. Company Verification

### Current Flow
1. Anyone registers an org with any name + domain (no verification) via `/for-employers`
2. First person to register becomes admin automatically (`routes/team.py:384-395`)
3. `is_domain_verified` field exists but is **never checked at runtime**
4. Org can immediately post jobs, verify claims, search candidates
5. Legacy fallback: if auth user's email matches `organizations.admin_email`, they auto-become admin (`middleware/auth.py:120-163`)

### Problems / Gaps

| # | Issue | Severity | File | Line |
|---|-------|----------|------|------|
| CO.1 | **CRITICAL: Anyone can register any domain** — attacker registers `google.com`, becomes admin, verifies fake claims | CRITICAL | `routes/team.py` | org creation |
| CO.2 | **CRITICAL: Legacy admin_email auto-promotion** — if attacker gets auth account with email matching org's admin_email, they become admin | CRITICAL | `middleware/auth.py` | 120-163 |
| CO.3 | **`is_domain_verified` is decorative** — field exists, never enforced. Orgs get full trust with unverified domains | HIGH | `models/organization.py` | — |
| CO.4 | **First-to-register wins** — race condition. Whoever registers `stripe.com` first owns it. No dispute or claim process. | HIGH | `routes/team.py` | first member logic |
| CO.5 | **ON DELETE CASCADE deletes everything** — if org is deleted, all members, claims, jobs, applications cascade delete. No recovery. | MEDIUM | `migrations/001` | schema |
| CO.6 | **No org approval queue** — every registration is immediately active | MEDIUM | — | — |
| CO.7 | **No company description/about field** — just name + domain + logo. Feels empty. | LOW | `models/organization.py` | — |

### TODOs

| # | Task | Priority | Details |
|---|------|----------|---------|
| CO.T1 | **Require work email match on org registration** | P0 | Person registering `stripe.com` must have `@stripe.com` email in their Supabase auth. This is the minimum gate. Not DNS — just email match. |
| CO.T2 | **Remove legacy admin_email fallback** | P0 | Delete lines 120-163 in `middleware/auth.py`. This auto-promotion path is a takeover vector. All workspace access should go through `company_members` table only. |
| CO.T3 | **Enforce `is_domain_verified` for sensitive actions** | P0 | Unverified orgs can: view dashboard, invite members. Unverified orgs CANNOT: post Gold ✓ jobs, verify candidate claims, appear in company directory. This makes DNS verification a trust upgrade, not a signup gate. |
| CO.T4 | **Add progressive verification tiers** | P1 | Tier 1: Work email match (auto, on signup). Tier 2: Verifier inbox configured (manual). Tier 3: DNS TXT record verification (premium). Display tier badge on company profile. |
| CO.T5 | **Add org registration queue for contested domains** | P1 | If someone tries to register a domain that's already taken, show "This company is already on Stamp. Request to join instead." with link to workspace join flow. |
| CO.T6 | **Add soft delete for organizations** | P2 | Replace CASCADE with soft delete (is_deleted flag + deleted_at). Preserve data, hide from queries. |
| CO.T7 | **DNS TXT verification flow** | P2 | "Add this TXT record to your domain: `stamp-verify=abc123`". Check via DNS lookup. Set `is_domain_verified=true`. This is the premium trust layer. |
| CO.T8 | **Add company description field** | P3 | Optional 500-char about section on org profile. |

### Long-term Target State
- Progressive trust: email match → verifier inbox → DNS verification
- DNS is NOT a gate — it's a premium upgrade that unlocks Gold ✓ jobs and directory listing
- Contested domain resolution: if two people claim the same domain, require DNS proof to settle
- Future: Verify via Crunchbase/LinkedIn company data cross-reference

---

## 3. Recruiter Verification

### Current Flow
1. Admin invites member by email (must match org domain) — `routes/team.py:79-153`
2. OR member self-joins if email domain matches org domain — `routes/team.py:293-428`
3. Self-joining member gets zero permissions by default
4. Admin grants permissions: `can_post_jobs`, `can_verify_claims`
5. Invitation email is **not actually sent** — invite record is created silently

### Problems / Gaps

| # | Issue | Severity | File | Line |
|---|-------|----------|------|------|
| RE.1 | **CRITICAL: Self-join = auto-admin if first** — first person from `@company.com` to self-join becomes admin with all permissions | CRITICAL | `routes/team.py` | 384-395 |
| RE.2 | **Self-join has no approval gate** — any `@company.com` email auto-joins. No admin approval required. | HIGH | `routes/team.py` | 293-428 |
| RE.3 | **Invitation email not sent** — admin creates invite, invitee never knows. They discover it only if they happen to sign up. | HIGH | `routes/team.py` | 149 |
| RE.4 | **No invitation expiry** — invite records live forever in `company_members` with status=invited | MEDIUM | — | — |
| RE.5 | **No email verification on join** — domain match is the only check. If Supabase email is not verified, user still joins. | MEDIUM | `routes/team.py` | domain check |
| RE.6 | **Outreach has no rate limit** — any member with `can_post_jobs` can message unlimited candidates | MEDIUM | `routes/messaging.py` | outreach |
| RE.7 | **No role beyond admin/member** — no "hiring manager" or "viewer" role. Binary access. | LOW | `models/company_member.py` | — |

### TODOs

| # | Task | Priority | Details |
|---|------|----------|---------|
| RE.T1 | **Require admin approval for self-join** | P0 | Domain match creates `status=pending` membership. Admin gets notification. Admin approves/denies. No auto-admin for first joiner unless they registered the org. |
| RE.T2 | **Send invitation emails** | P0 | When admin invites `john@company.com`, send email via Resend: "You've been invited to join [Company] on Stamp. Click here to accept." |
| RE.T3 | **Require Supabase email verification** | P1 | Before workspace join, check `auth.users.email_confirmed_at IS NOT NULL`. Unverified emails cannot join. |
| RE.T4 | **Add invitation expiry (30 days)** | P1 | Invites older than 30 days auto-expire. Admin can re-invite. |
| RE.T5 | **Rate limit outreach** | P1 | Max 10 outreach messages per member per day. Stored in `company_members.daily_outreach_count` with date reset. |
| RE.T6 | **Add "pending" state to workspace join** | P1 | New column `status` value: `pending`. Admin sees pending members in team dashboard. Can approve or reject. |
| RE.T7 | **Add recruiter activity log** | P2 | Track: jobs posted, claims verified, outreach sent, applications reviewed. Visible to admin. |
| RE.T8 | **Add "hiring_manager" role** | P3 | Can view applications and message candidates but cannot post jobs or verify claims. Middle ground between admin and member. |

### Long-term Target State
- Recruiters are trusted because they belong to a verified company, not through individual KYC
- Workspace membership is gated: invited by admin OR domain match + admin approval
- Permissions are granular and admin-controlled
- Activity is logged and rate-limited
- No heavy onboarding for individual recruiters — the company verification carries their trust

---

## 4. Cross-cutting Protections

### Audit Logs

**Current state:** None. Zero audit trail anywhere.

| # | Task | Priority | Details |
|---|------|----------|---------|
| XC.T1 | Create `audit_logs` table | P1 | Columns: `id`, `actor_id`, `actor_type` (user/member/system), `action` (created/updated/deleted/verified/disputed), `resource_type` (claim/job/member/org), `resource_id`, `metadata` (JSONB), `ip_address`, `created_at`. |
| XC.T2 | Log all verification actions | P1 | Every verify/correct/dispute writes to audit_logs. Who did it, when, what changed. |
| XC.T3 | Log all permission changes | P1 | Admin grants/revokes permissions → audit log. Member joins/leaves → audit log. |
| XC.T4 | Log all job lifecycle events | P2 | Job created/published/paused/closed/filled → audit log with actor. |
| XC.T5 | Admin-visible audit dashboard | P3 | Frontend page for org admins to view activity log for their workspace. |

### Anti-Abuse / Anti-Gaming Controls

| # | Issue | What to do | Priority |
|---|-------|-----------|----------|
| XC.T6 | **Fake org registration** — attacker registers `google.com` | CO.T1 (email match) blocks this. CO.T3 (enforce `is_domain_verified`) limits damage. | P0 |
| XC.T7 | **Claim farming** — create 100 fake claims to look verified | Add per-user claim rate limit: max 10 pending claims at a time. | P1 |
| XC.T8 | **Verification token harvesting** — scrape emails for tokens | Tokens are already 256-bit random. Add one-time-use: token clears after first access (view), not just after action. | P1 |
| XC.T9 | **Outreach spam** — recruiter messages 500 candidates in a day | RE.T5 (rate limit). Also add candidate-side "Block this company" feature. | P1 |
| XC.T10 | **Dispute griefing** — org disputes legitimate claims to lock them | CV.T5 (cooldown). Also add candidate appeal flow: if claim locked at 5 disputes, candidate can request platform review. | P2 |
| XC.T11 | **Email domain spoofing** — register with fake @company.com | Require Supabase email verification (RE.T3). Supabase sends OTP to the email — if they can receive it, the email is real. | P1 |

### Edge Cases

| # | Edge Case | Current Handling | Recommendation |
|---|-----------|-----------------|----------------|
| XC.E1 | **Subdomains** (mail.google.com vs google.com) | Not handled. Domain match is exact. | Normalize to root domain (strip subdomains). Store both. Match on root. |
| XC.E2 | **Staffing agencies** (candidate works at Google but employed by Randstad) | Not handled | Allow dual claims: "Contractor at Google via Randstad." Verify with both orgs. Future feature. |
| XC.E3 | **Shared inboxes** (hr@company.com used by 5 people) | Verifier email is one email. Anyone with access can verify. | This is fine for now. Audit log (XC.T2) tracks which token was used. Future: require verifier auth. |
| XC.E4 | **Former employees verifying** | If verifier still has email access after leaving, they can verify/dispute | Token TTL (CV.T1) limits window. Future: link verifier to active company_member. |
| XC.E5 | **Dead companies** (company shut down, domain expired) | Claims stay in `awaiting_org` forever | Add "Company no longer active" status. Allow candidate self-attestation with flag: "Unverifiable — company closed." |
| XC.E6 | **Renamed/merged companies** (Facebook → Meta) | Domain change orphans old claims | Add domain alias table: `domain_aliases(old_domain, new_domain)`. Lookup checks both. |
| XC.E7 | **Contractors vs employees** | No distinction | Add `employment_type` field: "full-time", "part-time", "contract", "intern". Displayed on claim. |
| XC.E8 | **Personal email domains** (gmail.com, yahoo.com) | Not blocked. Someone could register `gmail.com` as org. | Blocklist of public email domains. Reject org registration for gmail.com, yahoo.com, hotmail.com, etc. |

---

## 5. Prioritized Execution Plan

### Must Do Now (before any outreach) — ALL DONE

| # | Task | Status |
|---|------|--------|
| 1 | **CO.T1: Require email domain match on org registration** | `done` — registrant email domain must match org domain |
| 2 | **CO.T2: Remove legacy admin_email fallback** | `done` — deleted from auth.py, all auth goes through company_members |
| 3 | **RE.T1: Require admin approval for self-join** | `done` — domain match creates `status=pending`, approve/deny endpoints added |
| 4 | **CV.T1: Add 30-day TTL to verification tokens** | `done` — `token_expires_at` column + check in verify.py, returns 410 |
| 5 | **CO.T3: Enforce `is_domain_verified` for sensitive actions** | `done` — enforced on jobs, claims, talent search, outreach, token verification |
| 6 | **XC.E8: Block public email domain org registration** | `done` — 30+ public domains blocked |
| 7 | **RE.T2: Send invitation emails** | `done` — workspace invite email via Resend on invite/re-invite |
| 8 | **CV.T2: Invalidate old tokens on re-submission** | `done` — token replaced atomically in update |

### Should Do Soon (before first 100 users) — MOSTLY DONE

| # | Task | Status |
|---|------|--------|
| 9 | XC.T1-T3: Audit log table + verification/permission logging | `done` — audit_logs table, logging on verify/correct/dispute/permissions/member actions |
| 10 | RE.T3: Require Supabase email verification | `done` — checks email_confirmed_at before workspace join |
| 11 | RE.T5: Outreach anti-abuse | `done` — per-org cooldown, duplicate prevention, volume logging (replaced hard cap) |
| 12 | CV.T3: Show correction diff before acceptance | `done` — correction-diff endpoints added |
| 13 | CO.T5: Contested domain handling | `todo` |
| 14 | XC.T7: Per-user claim rate limit (10 pending) | `done` |
| 15 | RE.T4: 30-day invitation expiry | `todo` |
| 16 | XC.E1: Subdomain normalization | `done` — `mail.google.com` → `google.com` |

### Later / Scale Phase

| # | Task | Status |
|---|------|--------|
| 17 | CO.T4: Progressive verification tiers (email → verifier → DNS) | `todo` — architecture designed, not yet surfaced in UI tiers |
| 18 | CO.T7: DNS TXT verification flow | `done` — start/check endpoints + employer settings UI |
| 19 | XC.T5: Admin audit dashboard | `todo` |
| 20 | CV.T5: Dispute cooldown | `todo` |
| 21 | CV.T6: Structured dispute reasons | `todo` |
| 22 | RE.T7: Recruiter activity log | `todo` |
| 23 | RE.T8: Hiring manager role | `todo` |
| 24 | XC.E2: Staffing agency dual claims | `todo` |
| 25 | XC.E5: Dead company handling | `todo` |
| 26 | XC.E6: Domain alias table | `todo` |
| 27 | XC.E7: Employment type field | `todo` |
| 28 | CV.T7: Verification age/freshness display | `todo` |

### Additional items completed (not in original plan)

| # | Task | Status |
|---|------|--------|
| 29 | Candidate block-company (block/unblock/list, filtered from search + outreach) | `done` |
| 30 | Candidate trust-state guidance (open-to-work warning, verification nudge, welcome update) | `done` |
| 31 | Employer trust-state guidance (dashboard banner, talent search gated state, gold badge) | `done` |
| 32 | Frontend apply button gating (checks verified claims before showing) | `done` |
| 33 | DNS verification UI (employer settings: start → instructions → check → success) | `done` |
| 34 | Expanded verifier email policy (founder@, admin@, ceo@ etc. accepted) | `done` |
| 35 | Cron uses token_expires_at as primary expiry signal | `done` |

---

## Key Architecture Decisions

1. **Verification is claim-level, not person-level.** A person is not "verified" — each claim is independently verified. This stays.

2. **Company trust is progressive, not binary.** (IMPLEMENTED)
   - Tier 0: Registered (no verification) → can view dashboard, invite members, prepare jobs
   - Tier 1: Email domain match (auto on registration) → workspace access
   - Tier 2: DNS verified (`is_domain_verified=true`) → Gold ✓ jobs, claim verification, talent search, outreach, company directory listing

3. **DNS is not a gate.** It's a premium trust upgrade. Companies can onboard, set up workspace, invite teammates, and draft jobs without DNS verification. DNS unlocks trust-sensitive actions.

4. **Recruiter trust inherits from company.** A recruiter is trusted because their company is verified. No individual KYC for recruiters. (IMPLEMENTED: `require_domain_verified` on all sensitive employer endpoints)

5. **Sensitive actions require both domain verification AND permissions.** Domain verification gets the org trusted. Permissions (set by admin) determine what individual members can do. (IMPLEMENTED: `require_domain_verified` + `require_permission` checks)

6. **Token-based verification is the moat.** No login required for verifiers. TTL enforced (30-day expiry with 410 response). Token-based endpoints also check `is_domain_verified` on the org.

7. **Candidates must earn trust to enter recruiter surfaces.** (IMPLEMENTED) At least 1 verified claim required before: applying to jobs, appearing in talent search, receiving outreach. Self-reported profiles stay private until verified.

8. **Anti-abuse over hard caps.** (IMPLEMENTED) No hard daily outreach limits for verified recruiters. Instead: per-org-per-candidate cooldown (7 days), duplicate prevention, suspicious volume logging, candidate block-company feature.

---

## Files That Need Changes

| File | Changes needed |
|------|---------------|
| `backend/app/middleware/auth.py` | Remove legacy admin_email fallback (lines 120-163). Add email verification check. |
| `backend/app/routes/team.py` | Add admin approval for self-join. Send invitation emails. Add pending state. Add invitation expiry. |
| `backend/app/routes/claims.py` | Add token TTL check. Invalidate old tokens on re-edit. Add claim rate limit. |
| `backend/app/routes/verify.py` | Check token expiry. Show expired page. One-time-use tokens. |
| `backend/app/routes/employer.py` | Dispute cooldown. Structured dispute reasons. |
| `backend/app/routes/jobs.py` | Enforce `is_domain_verified` for Gold ✓ job posting. |
| `backend/app/routes/messaging.py` | Outreach rate limiting. |
| `backend/app/routes/companies.py` | Block public email domains. Contested domain handling. |
| `backend/app/models/organization.py` | Add verification_tier field. |
| `backend/app/models/claims.py` | Add token_expires_at field. |
| `backend/app/models/company_member.py` | Add pending status. Add daily_outreach_count. |
| `backend/app/services/email.py` | Add invitation email template. Add token expiry email template. |
| `backend/migrations/009_verification_hardening.sql` | New migration: audit_logs table, token_expires_at, verification_tier, domain_blocklist, pending status. |
