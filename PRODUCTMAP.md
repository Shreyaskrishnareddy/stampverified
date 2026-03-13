# Stamp — Product Map

> This file is the strategic source of truth for Stamp (stampverified.com).
> Feed this to any AI assistant or new team member for full context.
> Last updated: 2026-03-12

---

## What is Stamp?

A **trusted professional marketplace** where both sides are verified. Candidates have employer-verified credentials. Employers are verified organizations. No fake resumes. No fake job postings. Just proof.

Stamp is NOT a verification tool. It's NOT social media. It's **trust infrastructure** — a platform where verified professionals meet verified employers, and the verified data becomes the foundation for a B2B API business.

**One-liner:** The verified professional identity platform. Employers confirm your claims, a badge appears.

**The vision rests on three trust layers:**
1. **Candidate verification** — verified profiles with employer-confirmed claims (BUILT)
2. **Employer & recruiter verification** — verified orgs, verified recruiter accounts, verified postings (NEXT)
3. **Trusted jobs marketplace** — only verified candidates, only verified recruiters, only verified jobs (AFTER)

See `ROADMAP.md` for the full implementation plan with phases, schema, and milestones.

---

## Why Stamp Exists

### The Problem
- 78% of resumes contain misleading statements
- Background checks cost $30-100 and take 3-5 days
- Every professional profile on the internet is self-reported
- Employers waste time on candidates with fake credentials
- Candidates get scammed by fake job postings from unverified companies

### Why Not Payroll APIs (Truework, Checkr)?
They serve **employers** — the hiring company pays $30-100 per check, the candidate has zero control or ownership. The verification result goes to the employer, not the individual. Next job? Pay again. The candidate never owns their verification.

### What Stamp Does Differently
**Stamp gives the individual ownership of their verified professional identity.**
- You verify ONCE, carry it FOREVER
- One shareable link — on your resume, LinkedIn, email signature
- Any employer can see your verified credentials instantly
- No $30-100 fee. No 3-5 day wait. Already verified.
- AND — verified employers get access to verified candidates. No fake resumes.

### The Moat
- **Payroll APIs can't replicate this** — they serve employers, not individuals. No portable identity.
- **LinkedIn can't replicate this** — they're incentivized NOT to verify (it would expose inflated profiles and hurt engagement)
- **The data compounds** — every verified claim is permanent value that can't be replicated overnight
- **Both-sides-verified marketplace** — candidates want to be where verified employers are, and vice versa

---

## Core Verification Model

### How It Works
1. User signs up (Google OAuth primary, email/password secondary)
2. User creates profile (name, headline, location)
3. User adds employment or education claim (picks company/university from Clearbit autocomplete)
4. If org is registered on Stamp → verification email sent to org's HR email
5. If org is NOT registered → claim sits at `awaiting_org` → user shares invite link with their HR team
6. HR clicks verification link in email → sees claim details → clicks Verify, Correct, or Dispute
7. Claim status updates, badge appears on user's public profile

### Non-Negotiables
- **Only HR verifies.** Not managers, not colleagues, not interns. One authorized HR representative per org via role-based email.
- **Users cannot provide verifier emails.** Trust comes from org-level verification only. Users pick the company from autocomplete, they never enter an HR contact.
- **Verification is at-source.** The org (employer/university) is the authority. No peer verification, no self-reported endorsements.
- **Companies must come from Clearbit autocomplete.** No manual "use as entered" fallback. If a company isn't in Clearbit, it doesn't exist on Stamp. Prevents fake companies.

---

## The Two-Sided Trust Marketplace

### Why This Matters

**LinkedIn today:**
- Candidates lie on resumes → employers can't trust profiles
- Fake job postings from fake companies → candidates get scammed
- Recruiters pay $800/month to search through unverified noise
- No trust on either side

**Stamp:**
- Every candidate's background is verified by the source
- Every employer is a verified organization
- Both sides KNOW the other is real
- Trust is the entry ticket — both sides must be verified to participate

### For Candidates
- Every company on Stamp is real. Every job posting comes from a verified org.
- No need to prove yourself repeatedly — your profile IS the proof
- You carry your verified identity everywhere
- Attract employers instead of chasing them

### For Employers
- Every candidate has verified credentials. Zero resume fraud.
- No background check needed — it's already done
- Faster hiring — skip the 3-5 day verification wait
- Cheaper — no $30-100 per candidate verification cost
- Higher quality pool — only people confident enough to get verified are here

### The Flywheel
```
More verified candidates → employers want access
    → more employers register → more claims get verified
        → more candidates join → more verified candidates
            → cycle continues, both sides grow
```

### The Key Insight
The verification IS the filter. On LinkedIn, anyone can show up. On Stamp, **you earn your place by getting verified.** This creates a naturally high-quality talent pool without any AI screening or algorithms. The verification process does the filtering for free.

---

## Organization Model

### How Orgs Join Stamp
1. User adds a claim → claim goes to `awaiting_org`
2. User clicks "Invite your company" → gets a signed invite link (HMAC-signed, tamper-proof)
3. User shares the link with their HR team via any channel (email, Slack, WhatsApp, LinkedIn)
4. HR clicks the link → lands on registration page → enters role-based corporate email (hr@company.com, people@company.com, etc.)
5. Stamp verifies email domain matches the company domain
6. Org is registered → all pending claims for that domain auto-link → HR can start verifying

### Role-Based HR Email
- Org registers with a **shared/role-based email** (hr@company.com), not a personal email
- This solves HR turnover — when people leave, the inbox stays
- Whoever has access to the HR inbox is authorized by the company
- No Stamp login/account needed for basic verification — token in email IS the auth

### Org Verification (Email-Based, No Login Required)
- Stamp sends verification email to org's registered HR email
- Email contains: claim details + secure token link
- HR clicks link → sees claim → takes action (Verify/Correct/Dispute)
- No dashboard, no password, no account needed
- Token is cryptographically secure (32-byte `secrets.token_urlsafe`)
- Token is the auth — whoever has access to the HR inbox is authorized

### Employer Dashboard (Optional/Premium)
- Not required for verification — email flow handles everything
- Dashboard is a premium upgrade for orgs that want: bulk review, departure tracking, analytics
- Available at `/employer/dashboard` for registered org admins

### Anti-Fraud Layers
1. **Clearbit-only companies** — no manual entry, prevents fake companies
2. **Role-based HR email only** — hr@, people@, careers@ — not personal emails like john@company.com
3. **No self-verification** — org registrant cannot have claims at the same company
4. **Full audit trail** — every verification logs: verifier name, email, timestamp, IP address
5. **API returns confidence metadata** — consumers assess trust level themselves

### Org Registration Security
- Invite links are HMAC-signed to prevent tampering
- "Claim your organization" escalation path if wrong person registers a domain (DNS verification or business document proof)
- First registrant gets admin access; can be contested by real HR through escalation

---

## Claim Lifecycle

### Status Machine
```
User adds claim
    ↓
    → awaiting_org (org not on Stamp yet)
    → awaiting_verification (org registered, email sent to HR)

awaiting_org → org registers → awaiting_verification

awaiting_verification
    → verified (HR confirmed)
    → correction_proposed (HR proposed corrections)
    → disputed (HR rejected)
    → expired (30 days, no response)

correction_proposed
    → verified (user accepts org's corrections — org's version goes on profile)
    → awaiting_verification (user denies, claim resubmitted)

disputed
    → awaiting_verification (user edits and resubmits — max 5 times)
    → permanently_locked (after 5 disputes)

expired
    → awaiting_verification (user resends — one resend allowed)
```

### Key Rules
- **Dispute resubmission limit: 5 attempts.** After 5 disputes on the same claim, it's permanently locked.
- **When org corrects, the org's version is the truth.** If the user accepts corrections, the corrected data (from the source) goes on the profile.
- **Expiry: 30 days.** If org doesn't respond in 30 days, claim expires. User gets one resend.
- **Verified claims are point-in-time stamps.** "As of [date], [org] confirmed this claim." The statement doesn't expire.
- **Departure tracking keeps data live.** HR marks departures in real-time — end date updates, is_current flips to false.
- **Disputed claims hidden from public profile.** Visible in user's dashboard, hidden from public view.

---

## Data & Privacy

### Account Deletion
- **Delete means full delete.** No anonymized records, no ghost data, no data retention.
- Implemented as atomic database transaction — everything deletes or nothing does.
- If user returns, they start fresh and re-verify everything.
- This is a trust signal: "We don't hold your data hostage."

### Data Freshness
- **Current employment:** Kept accurate via real-time departure tracking by HR.
- **Past employment:** Verification is a point-in-time stamp with verification date.
- **API returns verification date** so consumers can judge recency themselves.

### Legal Model
- User consents by submitting their own claim (they provide their own data)
- Org only confirms or denies — they never upload employee data to Stamp
- Similar legal basis to reference checks
- Must have lawyer review ToS and Privacy Policy before launching API product
- FCRA compliance required before launching B2B verification API (Phase 3)

---

## Go-to-Market Strategy

### Phase 1: Universities First (Months 0-6)
- Direct partnerships with university registrar offices
- They already handle verification as part of their job
- One partnership = thousands of verified degrees overnight
- Target: 20 university partnerships
- Pitch: "Your graduates are building verified profiles. Connect once, every degree is permanently verified. Free branding for your institution."

### Phase 2: Employers via Grad Traction (Months 6-12)
- Use verified grad base to attract employers
- Pitch to employers: "5,000 candidates with verified degrees are on Stamp. Register your company to verify their employment AND access this pre-verified talent pool. No fake resumes."
- Track which companies have the most `awaiting_org` claims — prioritize outreach
- Demand-driven: user invites create organic signal
- The employer doesn't register to do Stamp a favor — they register to **access verified talent**

### Phase 3: Trusted Marketplace (Months 12-18)
- Verified employers can browse/search verified candidates
- Recruiter seat subscriptions ($49-99/month)
- Both sides are verified — trust is the entry ticket
- Position as the anti-LinkedIn: "Every candidate is real. Every company is real."

### Phase 4: B2B Data Business (Month 18+)
- B2B verification API: instant employment/education verification at $0.50-2/query
- Real-time employment status API for lenders (mortgage, auto loans, credit)
- Background check replacement for hiring companies
- The verified data accumulated in Phases 1-3 IS the product

---

## Business Model

### Revenue Phasing

**Year 1: $0 — Build the trust layer**
- Free for everyone. Chase traction, not revenue.
- Target: 20 university partnerships, 100+ companies, 50,000+ verified claims
- Prove the verification loop works (60%+ verification rate)

**Year 2: First revenue — Marketplace + recruiter seats**
| Product | Price | Target |
|---------|-------|--------|
| Recruiter seat (search verified candidates) | $49-99/month | Replaces $800+/month LinkedIn Recruiter |
| Premium employer dashboard | $29/month | Analytics, bulk review, departure tracking |

**Year 3+: Scale revenue — B2B data business**
| Product | Price | Market |
|---------|-------|--------|
| B2B verification API (hiring) | $0.50-2/query | $4.5B background check industry |
| Real-time employment status API (lending) | $2-5/query | Mortgage, auto loans, credit |
| Verified salary intelligence | $10K+/year subscription | HR teams, compensation consultants |
| Identity integrations ("Sign in with Stamp") | Per-check fee | Job boards, platforms, marketplaces |

### Why This Sequence Matters
1. You can't sell data you don't have → build the trust layer first (free)
2. You can't charge recruiters without candidates → build the verified pool first
3. You can't sell API access without volume → accumulate verified claims first
4. Each phase funds and enables the next

### Cost Structure (MVP)
| Service | Cost |
|---------|------|
| Vercel (frontend) | Free |
| Render (backend) | Free ($7/mo to remove cold starts) |
| Supabase (DB + auth) | Free |
| Resend (email) | Free (100/day) |
| Domain | ~$10/year |
| **Total** | **<$20/month** |

---

## Revenue Opportunities (Long-Term)

### 1. Background Check Replacement (Hiring)
- $4.5B market. Stamp API at $0.50/query vs. $30-100 traditional.
- Every hiring company is a customer.

### 2. Employment Verification for Lending
- Every mortgage, car loan, personal loan requires employment verification.
- Stamp's departure tracking = real-time employment status. Banks would pay $2-5/check.
- This is what Truework built before Checkr acquired them for $480M.

### 3. Recruiter Seats
- Search/filter verified candidates for $49-99/month.
- 10x more trustworthy than LinkedIn's unverified pool.
- Recruiters pay for quality, not quantity.

### 4. Verified Salary Intelligence
- Users voluntarily add salary to verified claims.
- "Software Engineer at Google, $185K — Verified by Google HR."
- Worth 100x Glassdoor's self-reported data.

### 5. Professional Identity Layer
- "Sign in with Stamp" — other platforms integrate Stamp for verified identity.
- Job boards, freelance marketplaces, dating apps, visa applications.
- Per-check fee or subscription.

### 6. Compliance-Mandated Industries
- Healthcare, finance, education, government REQUIRE verification.
- Can't opt out. Stamp becomes mandatory infrastructure.

---

## North Star Metric

**Verification Rate** — percentage of submitted claims that get verified.

- If claims don't get verified, profiles stay unverified, there's no marketplace, there's no data to sell, users churn.
- Target: 60%+ verification rate across all claims.
- This is the health metric of the entire product.

### Supporting Metrics
- Number of verified claims (the asset)
- Number of registered orgs (supply side)
- Org response time (how fast HR verifies)
- User retention (do verified users stay active?)

---

## Brand & Design

### Positioning
- **Phase 1-2:** Consumer-friendly but credible — "Your career, verified."
- **Phase 3+:** Institutional authority — "The professional verification standard."
- Not a startup tool, not social media — trust infrastructure

### Design Principles
- Apple-like design. Generous whitespace. Clean typography.
- Blue accent (#2563EB). Inter font. Subtle shadows.
- The verified badge IS the product — make it prominent but elegant.
- Green check = verified. Red x = disputed. Grey clock = pending.
- Mobile-responsive from day 1.
- No clutter. Every element earns its place.
- Verification emails: clean, minimal, professional — like Stripe receipts.

---

## Technical Decisions

### Architecture
| Layer | Tech | Hosting |
|-------|------|---------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | Vercel |
| Backend | FastAPI (Python 3.11) | Render |
| Database | PostgreSQL | Supabase |
| Auth | Supabase Auth (Google OAuth primary) | Supabase |
| Email | Resend | Resend.com |

### Auth
- Google OAuth is the primary signup path
- Email/password is secondary — requires email verification (8 char minimum)
- OAuth users are already email-verified by Google
- Backend uses JWT middleware for auth — no RLS (backend is the security layer)

### Key Technical Decisions
- **No rate limiting for MVP** — add when traffic warrants it
- **No pagination for MVP** — add LIMIT when queries get slow
- **No SSR for MVP** — client-rendered pages are fine, OG tags handle social previews
- **No structured logging for MVP** — print statements in Render console
- **Stay on Supabase** — upgrade tiers when limits are hit, not before
- **Dashboard is 714 lines** — don't refactor until it hurts
- **Clearbit logos** — free, no API key, one-line swap from logo.dev
- **Tests: verification state machine only** — test every status transition exhaustively
- **Account deletion: atomic transaction** — PostgreSQL function, full wipe
- **CORS: not a security concern** — JWT auth is the real security layer

### Email Infrastructure
- SPF/DKIM/DMARC required on stampverified.com before launch
- Stamp only emails opted-in orgs (already registered)
- User shares invite links — Stamp does NOT cold-email organizations
- One email per new claim to org's HR email
- Minimal, professional email templates (like Stripe receipts)

---

## Scope — What's IN for MVP

- [x] Google OAuth + email/password signup (email verification for password users)
- [ ] Profile creation (name, headline, location, avatar)
- [ ] Employment claims (company from Clearbit autocomplete, title, dates)
- [ ] Education claims (institution, degree, field, dates)
- [ ] Org registration with role-based HR email + domain verification
- [ ] HMAC-signed invite links for org onboarding
- [ ] Token-based email verification (no login required for HR)
- [ ] Verify / Correct / Dispute flow
- [ ] Departure tracking by HR
- [ ] 5 resubmission limit on disputed claims
- [ ] 30-day claim expiry with one resend
- [ ] Public profile page (verified claims only shown with status badges)
- [ ] Clean verification emails
- [ ] Full account deletion (atomic, zero trace)
- [ ] Verification state machine tests

## Scope — What's OUT for MVP

- No freelancer/contractor verification
- No subsidiary/parent company domain mapping
- No dead company handling
- No resume parser
- No skill endorsements
- No recruiter search / marketplace features
- No job matching
- No salary data
- No B2B API (Year 2+)
- No payments
- No rate limiting
- No pagination
- No SSR
- No structured logging
- No RLS policies
- No HRIS integrations
- No dark mode
- No mobile app

---

## Competitive Landscape

### Why Stamp Wins

| | LinkedIn | Truework/Checkr | Stamp |
|---|---|---|---|
| **Who it serves** | Advertisers (users are the product) | Employers (candidate has no control) | The individual (you own your identity) |
| **Data quality** | Self-reported, no checks | Verified via payroll API | Verified at source by org HR |
| **Portability** | Locked in LinkedIn | One-time check, not portable | Verify once, carry forever |
| **Both sides verified?** | No | No (only candidate checked) | Yes — verified candidates + verified employers |
| **Cost to verify** | N/A | $30-100 per check | Free (org verifies, user shares) |
| **Incentive to verify?** | Incentivized NOT to (engagement > truth) | Employer pays per check | Both sides benefit (trust marketplace) |
| **Departure tracking** | No | Payroll-dependent | Real-time, HR-managed |

### The Real Comparable
**Plaid** — built the identity layer for financial data (connecting bank accounts to apps). Valued at $13.4B. Stamp is building the identity layer for professional data (connecting verified careers to any platform that needs it).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Cold start (no orgs verifying) | Universities first — registrar offices already do this |
| HR ignores verification emails | Role-based emails (hr@) go to the team, not one person. Token-based = 30 seconds to verify. |
| Fake org registration | Clearbit-only companies + role-based email + no self-verification |
| User games the system | Audit trail + 5 dispute limit + org is the authority |
| Email deliverability | Only email opted-in orgs, SPF/DKIM/DMARC, transactional only |
| LinkedIn copies this | LinkedIn is incentivized NOT to verify (it would expose inflated profiles) |
| Truework/Checkr compete | They serve employers. Stamp serves the individual. Different buyer, different moat. |
| GDPR/privacy compliance | Full deletion, no data retention, lawyer review before API launch |
| HRIS APIs make manual verification obsolete | Stamp can integrate HRIS too (Phase 3). Manual verification covers companies HRIS can't reach. |
| Nobody pays for recruiter seats | Validated by LinkedIn Recruiter at $800+/month. Stamp's pool is smaller but 100% verified. |

---

## Future Roadmap (Post-MVP)

> Full roadmap with implementation details in `ROADMAP.md`.

### Phase 2: Employer & Recruiter Verification (v1.1)
- `org_members` table with roles: admin, recruiter, verifier
- Recruiter accounts linked to verified orgs
- "Verified Recruiter at {Company}" badges
- Organization public profiles (`/org/{domain}`)

### Phase 3: Job Posting Model (v1.2)
- `jobs` table tied to verified orgs + verified recruiters
- `is_verified_posting` derived from org/recruiter state
- Job creation/management in employer dashboard
- Only verified employers can post

### Phase 4: Candidate-Facing Jobs Feed (v1.3)
- `/jobs` page — only jobs from verified employers
- Every job card shows verified org + recruiter badges
- Apply with Stamp Profile (no resume needed)
- Recruiter receives verified candidate profile

### Phase 5: Candidate Discovery (v1.4)
- Employer search by verified titles, companies, degrees
- "Open to work" toggle for candidates
- Recruiter outreach (first monetization: recruiter seats $49-99/month)

### Phase 6+: Data Business
- B2B verification API ($0.50-2/query)
- Employment status API for lenders ($2-5/query)
- FCRA compliance, HRIS integrations, "Sign in with Stamp"

---

## Key Definitions

| Term | Meaning |
|------|---------|
| **Claim** | A user's statement about employment or education (unverified until org confirms) |
| **Verification** | An organization confirming a claim is true |
| **Verified at source** | The employer/university — the entity that would know — confirmed the claim |
| **Trust infrastructure** | The underlying system that makes professional trust possible (not a social feature) |
| **Point-in-time stamp** | A verification records what was true at the time of confirmation. It doesn't expire. |
| **Departure tracking** | HR actively marking when an employee leaves, keeping data current |
| **Role-based email** | A shared inbox like hr@company.com that persists regardless of individual HR turnover |
| **HRIS** | Human Resource Information System — software companies use to manage employees (Workday, BambooHR, Gusto). Contains payroll, titles, dates. Has APIs that can automate verification. Phase 3+ for Stamp. |
| **FCRA** | Fair Credit Reporting Act — US law governing consumer reporting agencies. Stamp must comply before selling verification data via API. |
| **CRA** | Consumer Reporting Agency — legal designation required to sell employment verification data for hiring/lending decisions. |

---

## Context for AI Assistants

This document is the strategic source of truth for Stamp. If you're helping build this product:

1. Read this file first, then `SPEC.md`, then `DEPLOYMENT.md`, then the codebase
2. Every feature decision should be evaluated against: **"Does this strengthen or weaken the verification guarantee?"**
3. Do not suggest features that dilute trust (peer verification, self-reported endorsements, skill badges)
4. Do not over-engineer — MVP ships with minimum viable everything
5. Flag legal/regulatory risks proactively (GDPR, FCRA, CCPA)
6. The real product is the verified data, not the UI — but the marketplace is the growth engine
7. Quality of verification > quantity of users
8. Both sides must be verified — this is what makes Stamp different from everything else
9. Stamp is NOT competing with LinkedIn (social network) or Truework (employer tool) — it's building consumer-owned verified professional identity, which doesn't exist yet
10. The business phases are: trust layer → marketplace → data business. Don't skip phases.
