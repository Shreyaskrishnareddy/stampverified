# Stamp — Product Roadmap

> The implementation plan for building the verified professional marketplace.
> Last updated: 2026-03-13

---

## The Core Loop

```
Verified candidates build portable profiles with verified work and education claims.
Verified employers can post jobs only after their company and recruiter identity are verified.
Candidates browse only jobs from verified employers.
Employers see candidate profiles with clear proof signals, not just self-reported resumes.
```

**Positioning:**

> "Only verified candidates. Only verified recruiters. Only verified jobs."

or

> "LinkedIn is self-reported. Stamp is source-verified."

---

## Three Trust Layers

Everything Stamp builds rests on three trust layers. Each layer must be solid before the next one matters.

### Layer 1: Candidate Verification (BUILT)

A candidate profile shows:
- Verified roles (company, title, dates, department)
- Verified education (institution, degree, field)
- Verification date (when it was confirmed)
- What is still unverified (pending, awaiting org, disputed)

This is the foundation. It already works end-to-end.

### Layer 2: Employer & Recruiter Verification (NEXT)

A "verified employer" means:
- Company domain is verified
- Company admin is verified
- Recruiter works at that company (company email)
- Recruiter can only post on behalf of that verified company
- Badge: "Verified Recruiter at Stripe"

In practice:
- Verify company ownership via domain/email (already done)
- Require recruiter accounts to use company email
- Optionally require recruiter approval by company admin
- Show verified recruiter badges on all recruiter actions

### Layer 3: Trusted Jobs Marketplace (AFTER LAYER 2)

Jobs only exist if posted by verified employer accounts:
- No fake listings
- No anonymous recruiters
- Clear source of truth
- Every job card shows verified employer badge
- Recruiter identity is visible
- Apply flow routes through Stamp profile

---

## Implementation Phases

### Phase 1: Complete Candidate Verification (CURRENT — v1.0)

**Status: ~90% complete**

What's built:
- [x] User signup (Google OAuth + email/password)
- [x] Profile creation (name, username, headline, location, avatar)
- [x] Employment claims (Clearbit autocomplete, title, dates, department)
- [x] Education claims (institution, degree, field, dates)
- [x] Org registration with role-based email
- [x] HMAC-signed invite links
- [x] Token-based email verification (no login required for HR)
- [x] Verify / Correct / Dispute flow
- [x] 5 dispute limit, 30-day expiry
- [x] Public profile (verified claims only)
- [x] Departure tracking
- [x] Full account deletion
- [x] Notification system
- [x] Verification state machine tests

What remains:
- [ ] QA and polish all flows end-to-end
- [ ] Test with real organizations (manual verification cycle)
- [ ] Email deliverability monitoring
- [ ] First 5 real verified profiles

**Exit criteria:** 5+ real users with verified claims from real organizations.

---

### Phase 2: Employer & Recruiter Verification (NEXT — v1.1)

**Goal:** Make "verified employer" mean something real. Add recruiter accounts so individual recruiters are verified, not just the organization.

#### 2a. Recruiter Accounts & Roles

**Database changes:**

```
┌─────────────────────────────┐
│       org_members           │
│─────────────────────────────│
│  id                         │
│  organization_id (FK)       │
│  user_id (FK → auth.users)  │
│  email                      │
│  role (admin | recruiter    │
│        | verifier)          │
│  status (invited | active   │
│          | deactivated)     │
│  invited_by                 │
│  joined_at                  │
│  created_at                 │
└─────────────────────────────┘
```

**Roles:**
| Role | Permissions |
|------|------------|
| `admin` | Full org management, invite/remove members, post jobs, verify claims, org settings |
| `recruiter` | Post jobs on behalf of org, view candidate profiles, cannot verify claims |
| `verifier` | Verify/correct/dispute claims, cannot post jobs or manage members |

**Flow:**
1. Org admin (existing registration) becomes first `admin` member
2. Admin invites recruiters via company email
3. Recruiter signs up with that company email, gets `recruiter` role
4. All recruiter actions carry the org's verified badge
5. Admin can deactivate members (e.g., when they leave)

**Frontend:**
- Employer Settings: "Team" tab to manage members
- Invite flow: admin enters recruiter email → recruiter gets invite → signs up → linked to org
- Recruiter badge visible on all recruiter-facing surfaces

**API endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations/mine/members` | List org members |
| POST | `/api/organizations/mine/members/invite` | Invite member (admin only) |
| PUT | `/api/organizations/mine/members/{id}` | Update member role (admin only) |
| DELETE | `/api/organizations/mine/members/{id}` | Deactivate member (admin only) |
| POST | `/api/organizations/mine/members/accept` | Accept invite (invitee) |

#### 2b. Verified Employer Badges

**Badge system:**
- `Verified Organization` — domain verified, admin verified
- `Verified Recruiter at {Company}` — recruiter is an active member of a verified org
- `Verified Verifier at {Company}` — person who handles claim verification

**Where badges appear:**
- Job postings (org badge + recruiter badge)
- Employer dashboard (org badge in header)
- Public org profile page (new)
- Candidate-facing views of job listings

#### 2c. Organization Public Profiles

**New page:** `/org/{domain}` (e.g., `/org/stripe.com`)

Shows:
- Organization name, logo, domain
- Verified badge
- Number of verified employees on Stamp
- Active job postings (Phase 3)
- "Member since" date

**Exit criteria:** 3+ organizations with multiple members (admin + recruiter). Recruiter badges visible.

---

### Phase 3: Job Posting Model (v1.2)

**Goal:** Verified employers can post jobs. Every job is tied to a verified org and a verified recruiter.

#### 3a. Jobs Database

```
┌─────────────────────────────┐
│          jobs                │
│─────────────────────────────│
│  id                         │
│  organization_id (FK)       │
│  posted_by (FK → org_members│
│              .id)           │
│  title                      │
│  description (markdown)     │
│  location                   │
│  location_type (remote |    │
│    hybrid | onsite)         │
│  employment_type (full_time │
│    | part_time | contract   │
│    | internship)            │
│  salary_min                 │
│  salary_max                 │
│  salary_currency            │
│  department                 │
│  experience_level (entry |  │
│    mid | senior | lead |    │
│    executive)               │
│  status (draft | active |   │
│    paused | closed | filled)│
│  is_verified_posting        │
│    (derived: org verified   │
│     AND recruiter active)   │
│  posted_at                  │
│  expires_at                 │
│  created_at                 │
│  updated_at                 │
└─────────────────────────────┘
```

**Rules:**
- Only `admin` or `recruiter` role org members can post jobs
- Job inherits org's verified status
- `is_verified_posting` = org is verified AND poster is an active org member
- Jobs auto-expire after 30 days (configurable)
- Closed/filled jobs remain visible but marked

#### 3b. Job Posting Flow

```
Recruiter (verified) → Create job → Job goes active
                                        ↓
                          Visible to all candidates
                          Shows: verified org badge
                                 recruiter name + badge
                                 posting date
```

**API endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/` | List active jobs (public, filterable) |
| GET | `/api/jobs/{id}` | Job detail (public) |
| POST | `/api/employer/jobs` | Create job (recruiter/admin) |
| PUT | `/api/employer/jobs/{id}` | Update job (poster or admin) |
| DELETE | `/api/employer/jobs/{id}` | Close job (poster or admin) |
| GET | `/api/employer/jobs` | List org's jobs (recruiter/admin) |

**Frontend:**
- Employer Dashboard: "Jobs" tab alongside "Pending Claims" and "Employees"
- Job creation form: title, description (rich text), location, type, salary range, department, level
- Job management: edit, pause, close, mark as filled

**Exit criteria:** 10+ real job postings from verified employers.

---

### Phase 4: Candidate-Facing Jobs Feed (v1.3)

**Goal:** Candidates browse jobs — every listing is from a verified employer.

#### 4a. Jobs Feed Page

**New page:** `/jobs`

- List of active jobs from verified organizations only
- Each job card shows:
  - Job title
  - Company name + verified org badge
  - Location + type (remote/hybrid/onsite)
  - Salary range (if provided)
  - Posted by: recruiter name + verified recruiter badge
  - Posted date

**Filters:**
- Location / remote
- Employment type
- Experience level
- Department/function
- Company (search)

**Search:**
- Full-text search on title + description
- Company name search

#### 4b. Job Detail Page

**New page:** `/jobs/{id}`

Shows:
- Full job description
- Company info (name, logo, domain, verified badge, link to org profile)
- Recruiter info (name, verified badge)
- Salary range
- Apply button

#### 4c. Apply Flow

**Simple v1:** "Apply with Stamp Profile"
- Candidate clicks Apply
- If logged in with a profile → sends profile link to recruiter
- If not logged in → prompts signup
- Recruiter gets notification with candidate's verified profile link

**What the recruiter sees:**
- Candidate's name, headline
- Verified claims (green badges)
- Unverified claims (grey/pending)
- Verification dates
- Clear trust signals

No resume upload needed — the Stamp profile IS the verified resume.

**API endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs/{id}/apply` | Apply to job (sends profile to recruiter) |
| GET | `/api/employer/jobs/{id}/applicants` | List applicants (recruiter/admin) |

**Exit criteria:** Candidates can browse and apply to real jobs. Recruiters receive applications with verified profiles.

---

### Phase 5: Employer-Facing Candidate Discovery (v1.4)

**Goal:** Employers can search for verified candidates, not just wait for applications.

#### 5a. Candidate Search

**Employer Dashboard: "Find Candidates" tab**

Search/filter by:
- Verified title history (e.g., "Software Engineer")
- Verified companies (e.g., "worked at Google")
- Verified degrees (e.g., "CS degree from Stanford")
- Location
- Open to work status

**Candidate cards show:**
- Name, headline, location
- Verification summary (e.g., "3 of 4 claims verified")
- Key verified roles
- Trust score / verification badges

#### 5b. "Open to Work" Toggle

**Dashboard addition:**
- Candidates can toggle "Open to work" (visible only to verified employers)
- Optional: specify what they're looking for (role type, location, remote preference)

#### 5c. Recruiter Outreach

- Verified recruiters can send interest/message to candidates
- Candidate sees: "Verified Recruiter at Stripe is interested in your profile"
- Candidate can respond or ignore

**This becomes the monetization layer** — recruiter seats ($49-99/month) for search + outreach.

**Exit criteria:** Employers can search and find candidates by verified credentials. Initial recruiter seat pricing validated.

---

### Phase 6: Trust Visibility & Brand (Ongoing)

**Goal:** Make trust obvious everywhere in the UI.

#### Badge System

| Badge | Meaning | Where it appears |
|-------|---------|-----------------|
| Verified Candidate | Has 1+ verified claims | Profile, search results, job applications |
| Verified Employer | Org domain verified, admin verified | Job postings, org profile, employer dashboard |
| Verified Recruiter | Active member of verified org | Job postings, messages, candidate views |
| Verified Posting | Job from verified org + verified recruiter | Jobs feed, job detail |

**The triple-badge system is the brand:**
- Verified candidate
- Verified employer
- Verified recruiter

Every surface shows verification status. Trust is never implied — it's always explicit.

#### Trust Signals in UI

- Job cards: org badge + recruiter badge + posting date
- Candidate profiles: claim-level verification badges + dates
- Org profiles: member count + verified employee count
- Application view: side-by-side verified vs unverified claims
- Search results: verification percentage as a ranking signal

---

## Narrowing the Wedge

The biggest product risk is cold start. To solve it, pick ONE vertical first:

### Recommended: Tech Recruiting (Engineers / Product / Design)

**Why tech:**
- Engineers already share profiles (GitHub, personal sites) — adding verification is natural
- Tech companies are early adopters
- Recruiters in tech are the most active (and most willing to pay)
- Clearbit coverage is excellent for tech companies
- University CS programs are concentrated and reachable

**Alternative wedges (if tech doesn't work):**
| Wedge | Pro | Con |
|-------|-----|-----|
| University recruiting | Registrar offices are centralized | Slow institutional sales cycle |
| Healthcare hiring | Verification is legally mandated | Complex credentialing requirements |
| Startup hiring | Fast adopters, high volume | High churn, less brand recognition |

**The wedge determines:**
- Which universities to partner with first
- Which companies to onboard first
- What job categories to prioritize
- How to frame marketing

---

## Implementation Priority (What to Build Next)

```
NOW         Phase 1 completion: QA, real users, real verifications
            ↓
NEXT        Phase 2a: org_members table, recruiter accounts, roles
            Phase 2b: verified badges on all surfaces
            Phase 2c: org public profiles
            ↓
THEN        Phase 3: jobs table, job posting flow, employer jobs tab
            ↓
AFTER       Phase 4: /jobs feed, job detail, apply flow
            ↓
LATER       Phase 5: candidate search, open to work, recruiter outreach
```

Each phase is a usable product increment. Ship each one, get real usage, then build the next.

---

## Database Schema Evolution

### Current (v1.0)
```
auth.users → profiles → employment_claims
                       → education_claims
             organizations (standalone)
             notifications
```

### After Phase 2 (v1.1)
```
auth.users → profiles → employment_claims
                       → education_claims
             organizations → org_members (admin, recruiter, verifier)
             notifications
```

### After Phase 3 (v1.2)
```
auth.users → profiles → employment_claims
                       → education_claims
             organizations → org_members → jobs
             notifications
```

### After Phase 4 (v1.3)
```
auth.users → profiles → employment_claims
                       → education_claims
                       → job_applications
             organizations → org_members → jobs → job_applications
             notifications
```

---

## Revenue Milestones

| Phase | Revenue | Source |
|-------|---------|-------|
| 1-2 | $0 | Free — building trust layer |
| 3-4 | $0 | Free — building marketplace |
| 5 | First revenue | Recruiter seats ($49-99/month) for candidate search + outreach |
| 5+ | Growth | Premium employer dashboard, promoted job listings |
| Future | Scale | B2B verification API, employment status API, salary intelligence |

---

## Success Metrics by Phase

| Phase | North Star | Target |
|-------|-----------|--------|
| 1 | Verification rate | 60%+ of claims verified |
| 2 | Employer activation | 10+ orgs with recruiter accounts |
| 3 | Job posting volume | 50+ active jobs from verified employers |
| 4 | Application volume | 100+ applications through Stamp profiles |
| 5 | Recruiter conversion | 5+ paying recruiter seats |

---

## What This Is NOT

- Not a full ATS (applicant tracking system) — keep job management simple
- Not a social network — no feeds, no posts, no likes
- Not a resume builder — the verified profile IS the resume
- Not competing on features — competing on trust
- Not trying to replace LinkedIn overnight — starting with one wedge where verification matters most
