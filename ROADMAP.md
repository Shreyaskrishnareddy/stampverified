# Stamp — Product Roadmap

> The implementation plan for the trust-first hiring platform.
> Last updated: 2026-03-15

---

## The Core Loop

```
Confirmed candidates build portable profiles with employer-confirmed claims.
Confirmed companies post jobs through approved hiring team members.
Candidates browse jobs from real companies and apply with proof.
Employers see candidate profiles with confirmed experience — no fake resumes.
```

**Positioning:**

> "Confirmed candidates. Real companies. Real jobs."

---

## Three Trust Layers

Everything Stamp builds rests on three trust layers. Each layer must be solid before the next one matters.

### Layer 1: Candidate Confirmation (BUILT)

A candidate profile shows:
- Confirmed roles (company, title, dates, department) — blue ✓
- Confirmed education (institution, degree, field) — blue ✓
- Confirmation date (when it was checked)
- What is still unconfirmed (pending, awaiting org, disputed)

### Layer 2: Company & Hiring Team Confirmation (BUILT)

A confirmed company means:
- Company domain is registered on Stamp
- Company has at least 1 active admin
- Hiring team members use company email and are approved by admin
- Approved members can post jobs (gold ✓) and/or verify claims
- Every action traces to a real person at a real company

### Layer 3: Trusted Hiring Platform (BUILT)

Jobs only exist if posted by approved company members:
- Every job is from a registered company
- Every job has a real internal point of contact
- Candidates apply with confirmed profiles + resume
- Both sides communicate through the platform
- Trust is structural — no badges needed, being on Stamp IS the signal

---

## What's Built (v1.0)

### Candidate Side
- [x] Signup (Google OAuth + email/password)
- [x] Profile creation (name, username, headline, location, avatar)
- [x] Employment claims (company name or domain search, title, dates, department)
- [x] Education claims (institution search with logos, degree, field, dates)
- [x] Domain-first company search (type stripe.com → instant match with gold ✓)
- [x] Claim lifecycle: awaiting_org → awaiting_verification → verified/correction_proposed/disputed/expired/permanently_locked
- [x] Duration verification (dates + calculated duration shown prominently to verifiers)
- [x] Date validation (end > start, not future, not before 1950)
- [x] 5 dispute limit, 30-day expiry with one resend
- [x] Public profile (confirmed claims only, shareable)
- [x] Platform preferences (resume upload, job interests, open to work toggle)
- [x] Guided onboarding (claims grid hidden until profile created)
- [x] Jobs feed with Stamp Jobs / Internet Jobs toggle
- [x] Resume-to-jobs matching (upload PDF → extract skills/titles → JSearch API → matching jobs)
- [x] Job detail page with apply flow (verification gate: 1+ confirmed claim + resume required)
- [x] Save/bookmark jobs
- [x] Applications tracking (status: applied → shortlisted → rejected)
- [x] Messages (reply to outreach, message after applying, decline outreach)
- [x] Notification preferences (per-event toggles for in-app + email)
- [x] Smart redirect from job matching to signup with preserved context

### Company Side
- [x] Company registration (Clearbit-only companies, role-based verifier email)
- [x] Multi-member workspaces (admin + members, granular permissions)
- [x] Team management (invite, edit permissions, promote, deactivate)
- [x] Auto-join by email domain (first member → admin, subsequent → member)
- [x] Job posting (paste-first flow: paste JD or ATS URL → auto-extract → review → publish)
- [x] URL import (Greenhouse, Lever, Ashby — JSON-LD extraction)
- [x] Job function auto-detection from title (32 functions, 50+ keyword patterns)
- [x] Job management (pause, resume, close, mark filled)
- [x] Application inbox (per-job view, verified claims first, resume access, shortlist/reject)
- [x] Matching candidates tab (applied + open-to-work candidates per job)
- [x] Talent search (filter by title, company, degree, location; current employer auto-blocked)
- [x] Direct outreach (select job + 300 char note; candidate sees: who, what role, why)
- [x] Claim verification via dashboard (verify/correct/dispute with permissions)
- [x] Token-based email verification (no login required for HR)
- [x] HMAC-signed invite links for company onboarding
- [x] Departure tracking (mark employee left, update end date)
- [x] Employer settings (company details, verifier email, logo, password)

### Platform
- [x] Homepage with toggle ("I'm looking for work" / "I'm hiring") + hero demo card
- [x] Tagline: "Your career. Verified."
- [x] Companies directory (searchable, with job counts)
- [x] Company pages (logo, name, ✓, website, member since, employee count, active jobs)
- [x] Company request flow (for companies not in Clearbit)
- [x] Resume-to-jobs matching via JSearch API (Google Jobs aggregator)
- [x] Query+location caching (1hr TTL), resume quality validation, IP rate limiting (15/hr), monthly quota guardrail
- [x] Stamp Jobs vs Internet Jobs sections (gold ✓ jobs above, external jobs below)
- [x] Email notifications (verification, application status, messages, outreach — via Resend)
- [x] In-app notifications with unread count
- [x] Full account deletion (atomic PostgreSQL function, covers all tables)
- [x] Blue ✓ (candidates, individual claims) + Gold ✓ (companies, hiring team members)
- [x] Custom logo (stamp fold icon) across all surfaces + favicon
- [x] Mobile hamburger menu (Jobs, For Employers, Companies, Upload Resume)
- [x] Consistent empty states across all pages
- [x] 173 tests passing

### Security
- [x] JWT auth with JWKS (ES256, 1-hour TTL cache)
- [x] Granular permissions (can_post_jobs, can_verify_claims, admin role)
- [x] Token invalidation after verify/correct/dispute
- [x] HTML escaping in all email templates (XSS prevention)
- [x] SVG upload blocked (image allowlist: jpeg/png/webp/gif only)
- [x] Current password required for password change
- [x] Typed confirmation required for account deletion
- [x] HMAC secret runtime check (no hardcoded defaults)
- [x] Resume in private storage (signed URLs for access control)
- [x] Org registration validates DNS + registrant email domain match
- [x] Draft/paused jobs hidden from public access
- [x] Public profile filters sensitive fields (no notification_preferences leak)
- [x] POC name visibility: verified candidates always see recruiter identity
- [x] JSearch API rate limiting (15/hr per IP) + monthly quota guardrail (450 limit)

---

## What's Next (v1.1)

### Pre-Launch
- [x] Run migrations 003-008 on Supabase
- [x] Deploy to Vercel + Render
- [x] JSearch API configured and working
- [ ] End-to-end test with real accounts
- [ ] First 5 real verified profiles
- [ ] File trademarks (Stamp, StampVerified)
- [ ] Make GitHub repo private (protect trade secrets)

### Technical Debt
- [ ] Postgres full-text search for jobs (replace post-query text filter)
- [ ] "Most Relevant" sort powered by candidate preferences
- [ ] N+1 query optimization (employer dashboard, applications, conversations)
- [ ] Org-wide conversations (team can see each other's threads)
- [ ] Saved jobs page on frontend
- [ ] Debounce on jobs search input
- [ ] Closed job applications still accessible
- [ ] Reopen/reactivate closed jobs from UI
- [ ] Integrate with Finch/Merge APIs for programmatic verification

### Growth Features
- [ ] "Sign in with Stamp" for third-party integrations
- [ ] Recruiter seats pricing ($49-99/month)
- [ ] Premium employer dashboard ($29/month)
- [ ] B2B verification API ($0.50-2/query)
- [ ] Employment status API for lenders ($2-5/query)
- [ ] HRIS integrations (Workday, BambooHR, Gusto)
- [ ] FCRA compliance review (required before API launch)
- [ ] Mobile-responsive polish
- [ ] Error monitoring (Sentry)

---

## Go-to-Market

### Phase 1: Universities First (Months 0-6)
- Direct partnerships with registrar offices
- One partnership = thousands of confirmed degrees overnight
- Target: 20 university partnerships

### Phase 2: Employers via Grad Traction (Months 6-12)
- Use confirmed grad base to attract employers
- Track which companies have the most `awaiting_org` claims — prioritize outreach
- Target: 100+ companies, 50,000+ confirmed claims

### Phase 3: Recruiter Revenue (Months 12-18)
- Recruiter seat subscriptions ($49-99/month) for talent search + outreach
- Premium employer dashboard ($29/month) for analytics
- Both sides confirmed — trust is the entry ticket

### Phase 4: Data Business (Month 18+)
- B2B confirmation API: instant employment/education check at $0.50-2/query
- Real-time employment status API for lenders ($2-5/query)
- The confirmed data accumulated in Phases 1-3 IS the product

---

## Revenue Milestones

| Phase | Revenue | Source |
|-------|---------|-------|
| 1-2 | $0 | Free — building trust layer |
| 3 | First revenue | Recruiter seats ($49-99/month) |
| 3+ | Growth | Premium employer dashboard, promoted listings |
| 4+ | Scale | B2B API, employment status API, salary intelligence |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Confirmation rate | 60%+ of submitted claims confirmed |
| Employer activation | 10+ companies with multiple team members |
| Job posting volume | 50+ active jobs from confirmed companies |
| Application volume | 100+ applications through Stamp profiles |
| Recruiter conversion | 5+ paying recruiter seats |

---

## North Star Metric

**Confirmation rate** — percentage of submitted claims that get confirmed by the source. If claims don't get confirmed, profiles stay unconfirmed, there's no platform, there's no data to sell, users churn. Target: 60%+.

---

## Cost Structure (MVP)

| Service | Cost |
|---------|------|
| Vercel (frontend) | Free |
| Render (backend) | Free ($7/mo to remove cold starts) |
| Supabase (DB + auth) | Free |
| Resend (email) | Free (100/day) |
| Domain | ~$10/year |
| **Total** | **<$20/month** |

---

## What This Is NOT

- Not a full ATS — keep job management simple
- Not a social network — no feeds, no posts, no likes
- Not a resume builder — the confirmed profile IS the resume
- Not competing on features — competing on trust
- Not trying to replace anyone overnight — starting with one wedge where confirmation matters most
