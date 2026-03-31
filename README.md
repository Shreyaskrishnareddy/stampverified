# Stamp

**The verified professional identity platform.**

Employers confirm your claims, a badge appears. Verify once, carry forever.

---

## What is Stamp?

Stamp is trust infrastructure for professional identity. Users add employment or education claims, the employer or university confirms them, and a verified badge appears on their public profile.

Every professional profile on the internet is self-reported. Background checks cost $30-100 and take 3-5 days. Stamp fixes both problems — verification happens at the source, costs nothing, and the result belongs to the individual forever.

**How it works:**

```
User signs up → adds claim ("Software Engineer at Acme Corp")
    → Acme Corp's HR receives verification email
    → HR clicks link → reviews claim → clicks Verify
    → Verified badge appears on user's public profile
    → User shares profile link anywhere (resume, LinkedIn, email signature)
```

**What makes Stamp different:**

| | LinkedIn | Truework/Checkr | Stamp |
|---|---|---|---|
| Who it serves | Advertisers | Employers | The individual |
| Data quality | Self-reported | Payroll API | Verified at source |
| Portability | Locked in | One-time check | Verify once, carry forever |
| Cost | N/A | $30-100/check | Free |
| Both sides verified? | No | No | Yes |

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Frontend (Next.js) │────>│  Backend (FastAPI)    │────>│   Supabase       │
│   Vercel             │     │  Render               │     │   (Auth + DB)    │
│   stampverified.com  │     │  stamp-api-qtf9.      │     │                  │
│                      │     │  onrender.com         │     │                  │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
                                      │
                                      v
                              ┌──────────────────┐
                              │   Resend          │
                              │   (Email)         │
                              └──────────────────┘
```

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Vercel |
| Backend | FastAPI, Python 3.11 | Render |
| Database | PostgreSQL | Supabase |
| Auth | Supabase Auth (Google OAuth + email/password) | Supabase |
| Email | Resend | resend.com |
| Domain | stampverified.com | Namecheap |

---

## System Design

### Database Schema

```
┌─────────────────────────┐
│       auth.users        │  (Supabase Auth — managed)
│  id, email, provider    │
└────────────┬────────────┘
             │ 1:1
             v
┌─────────────────────────┐      ┌─────────────────────────┐
│        profiles         │      │     organizations       │
│─────────────────────────│      │─────────────────────────│
│  id (FK → auth.users)   │      │  id                     │
│  username (unique)       │      │  name                   │
│  full_name              │      │  domain (unique)         │
│  headline               │      │  org_type                │
│  location               │      │  admin_email             │
│  trust_score            │      │  verifier_email          │
│  created_at             │      │  logo_url                │
│  updated_at             │      │  is_domain_verified      │
└────────────┬────────────┘      │  created_at              │
             │ 1:many            │  updated_at              │
             v                   └────────────┬─────────────┘
┌─────────────────────────┐                   │ 1:many
│   employment_claims     │<──────────────────┘
│─────────────────────────│
│  id                     │
│  user_id (FK → profiles)│
│  organization_id (FK)   │
│  company_name           │
│  company_domain         │
│  title                  │
│  department             │
│  employment_type        │
│  start_date, end_date   │
│  is_current             │
│  verification_token     │
│  status                 │
│  dispute_count          │
│  verified_at            │
│  verified_by_org        │
│  corrected_*            │
│  disputed_reason        │
│  created_at, updated_at │
└─────────────────────────┘

┌─────────────────────────┐
│    education_claims     │  (same pattern as employment)
│─────────────────────────│
│  id                     │
│  user_id (FK → profiles)│
│  organization_id (FK)   │
│  institution            │
│  institution_domain     │
│  degree                 │
│  field_of_study         │
│  verification_token     │
│  status                 │
│  dispute_count          │
│  corrected_*            │
│  ...                    │
└─────────────────────────┘

┌─────────────────────────┐
│     notifications       │
│─────────────────────────│
│  id                     │
│  user_id (nullable)     │
│  org_admin_email (nullable) │
│  type                   │
│  title, message         │
│  claim_id, claim_table  │
│  is_read                │
│  created_at             │
└─────────────────────────┘
```

**Key relationships:**
- `profiles.id` references `auth.users.id` (1:1, CASCADE delete)
- `employment_claims.user_id` references `profiles.id` (1:many, CASCADE delete)
- `employment_claims.organization_id` references `organizations.id` (nullable — null when org not yet registered)
- `notifications` link to either a user (by `user_id`) or an org admin (by `org_admin_email`)

### Authentication Flows

**Google OAuth (primary):**

```
Browser                    Supabase Auth              Google
  │                            │                        │
  │  signInWithOAuth(google)   │                        │
  │ ──────────────────────────>│                        │
  │                            │   OAuth redirect       │
  │                            │ ──────────────────────>│
  │                            │                        │
  │                            │   Authorization code   │
  │                            │ <──────────────────────│
  │                            │                        │
  │  Redirect to /auth/callback with tokens in URL hash │
  │ <──────────────────────────│                        │
  │                            │                        │
  │  Parse tokens, store session                        │
  │  Redirect to /dashboard                             │
```

**Email/password (secondary):**

```
Browser                    Supabase Auth
  │                            │
  │  signUp(email, password)   │
  │ ──────────────────────────>│
  │                            │  Send confirmation email
  │  "Check your email"        │
  │ <──────────────────────────│
  │                            │
  │  User clicks confirm link  │
  │ ──────────────────────────>│
  │                            │  Email verified, account active
  │  signIn(email, password)   │
  │ ──────────────────────────>│
  │                            │
  │  JWT (access + refresh)    │
  │ <──────────────────────────│
```

**Backend JWT validation:**

```
Frontend                   Backend (FastAPI)           Supabase
  │                            │                        │
  │  API request               │                        │
  │  Authorization: Bearer JWT │                        │
  │ ──────────────────────────>│                        │
  │                            │  Fetch JWKS (cached)   │
  │                            │ ──────────────────────>│
  │                            │  ES256 public key      │
  │                            │ <──────────────────────│
  │                            │                        │
  │                            │  Verify JWT signature  │
  │                            │  Extract user_id, email│
  │                            │                        │
  │  Response                  │                        │
  │ <──────────────────────────│                        │
```

### Data Flows

**1. User adds an employment claim:**

```
Frontend                   Backend                     Supabase DB           Resend
  │                            │                          │                    │
  │  POST /api/claims/employment                          │                    │
  │  {company_name, company_domain, title, dates}         │                    │
  │ ──────────────────────────>│                          │                    │
  │                            │  Lookup org by domain    │                    │
  │                            │ ────────────────────────>│                    │
  │                            │  Org found / not found   │                    │
  │                            │ <────────────────────────│                    │
  │                            │                          │                    │
  │                            │  If org found:           │                    │
  │                            │    status = awaiting_verification             │
  │                            │    Generate 32-byte token│                    │
  │                            │    Insert claim          │                    │
  │                            │ ────────────────────────>│                    │
  │                            │                          │                    │
  │                            │    Send verification email                    │
  │                            │ ─────────────────────────────────────────────>│
  │                            │                          │                    │
  │                            │  If org NOT found:       │                    │
  │                            │    status = awaiting_org │                    │
  │                            │    Insert claim (no email sent)               │
  │                            │ ────────────────────────>│                    │
  │                            │                          │                    │
  │  Claim response            │                          │                    │
  │ <──────────────────────────│                          │                    │
```

**2. HR verifies a claim (token-only, no login):**

```
HR Email Client            Frontend                   Backend              Supabase DB
  │                            │                        │                      │
  │  Clicks verification link  │                        │                      │
  │ ──────────────────────────>│                        │                      │
  │                            │  GET /api/verify/{token}                      │
  │                            │ ──────────────────────>│                      │
  │                            │                        │  Find claim by token │
  │                            │                        │ ────────────────────>│
  │                            │                        │  Claim + org data    │
  │                            │                        │ <────────────────────│
  │                            │  Claim details          │                      │
  │                            │ <──────────────────────│                      │
  │                            │                        │                      │
  │  HR reviews, clicks Verify │                        │                      │
  │                            │  POST /api/verify/{token}/verify              │
  │                            │ ──────────────────────>│                      │
  │                            │                        │  Update status →     │
  │                            │                        │  "verified"          │
  │                            │                        │  Set verified_at,    │
  │                            │                        │  verified_by_org     │
  │                            │                        │ ────────────────────>│
  │                            │                        │                      │
  │                            │                        │  Notify user         │
  │                            │                        │ ────────────────────>│
  │                            │  "Claim verified!"     │                      │
  │                            │ <──────────────────────│                      │
```

**3. Organization registration and claim linking:**

```
HR Person                  Frontend                   Backend              Supabase DB
  │                            │                        │                      │
  │  Clicks HMAC-signed invite link                     │                      │
  │ ──────────────────────────>│                        │                      │
  │                            │  Decode + verify HMAC  │                      │
  │                            │ ──────────────────────>│                      │
  │                            │  Company info          │                      │
  │                            │ <──────────────────────│                      │
  │                            │                        │                      │
  │  Fills registration form   │                        │                      │
  │  (role-based email: hr@)   │                        │                      │
  │                            │  POST /api/organizations/                     │
  │                            │ ──────────────────────>│                      │
  │                            │                        │  Validate:           │
  │                            │                        │  - Domain not taken  │
  │                            │                        │  - Role-based email  │
  │                            │                        │  - No self-verify    │
  │                            │                        │                      │
  │                            │                        │  Insert organization │
  │                            │                        │ ────────────────────>│
  │                            │                        │                      │
  │                            │                        │  Auto-link claims:   │
  │                            │                        │  Find all claims     │
  │                            │                        │  with matching domain│
  │                            │                        │  and status =        │
  │                            │                        │  "awaiting_org"      │
  │                            │                        │                      │
  │                            │                        │  Update each:        │
  │                            │                        │  organization_id = X │
  │                            │                        │  status = "awaiting_ │
  │                            │                        │  verification"       │
  │                            │                        │ ────────────────────>│
  │                            │                        │                      │
  │                            │                        │  Notify each user    │
  │                            │                        │  "Your company       │
  │                            │                        │   joined Stamp"      │
  │                            │                        │ ────────────────────>│
  │                            │                        │                      │
  │                            │  Org created            │                      │
  │                            │ <──────────────────────│                      │
```

**4. Dispute and resubmission cycle:**

```
         HR disputes                    User edits & resubmits
            │                                    │
            v                                    v
  awaiting_verification ──> disputed ──> awaiting_verification ──> disputed
        (round 1)          count=1         (round 2)              count=2
                                                                     │
            ... repeats up to 5 times ...                            │
                                                                     v
  awaiting_verification ──> permanently_locked (count=5, no more resubmissions)
```

**5. Account deletion (atomic):**

```
Frontend                   Backend                     Supabase DB         Supabase Auth
  │                            │                          │                    │
  │  DELETE /api/settings/account                         │                    │
  │ ──────────────────────────>│                          │                    │
  │                            │  RPC: delete_user_account│                    │
  │                            │ ────────────────────────>│                    │
  │                            │                          │  BEGIN TRANSACTION │
  │                            │                          │  DELETE notifications
  │                            │                          │  DELETE education_claims
  │                            │                          │  DELETE employment_claims
  │                            │                          │  DELETE profiles   │
  │                            │                          │  COMMIT            │
  │                            │  Success                 │                    │
  │                            │ <────────────────────────│                    │
  │                            │                          │                    │
  │                            │  Delete auth user        │                    │
  │                            │ ─────────────────────────────────────────────>│
  │                            │                          │                    │
  │  "Account deleted"         │                          │                    │
  │ <──────────────────────────│                          │                    │
```

### Request Routing

```
Internet
  │
  │  stampverified.com/*
  v
Vercel (CDN + SSR)
  │  Static pages, client-side React
  │  All /api/* calls go to backend
  │
  │  stamp-api-qtf9.onrender.com/api/*
  v
Render (FastAPI)
  │
  ├── /api/profile/*        → profile.py      (JWT auth)
  ├── /api/claims/*         → claims.py       (JWT auth)
  ├── /api/verify/*         → verify.py       (token auth, no login)
  ├── /api/organizations/*  → organizations.py (JWT auth)
  ├── /api/employer/*       → employer.py     (JWT + org admin auth)
  ├── /api/notifications/*  → notifications.py (JWT auth)
  ├── /api/invite/*         → invite.py       (JWT for generate, public for decode)
  ├── /api/settings/*       → settings.py     (JWT auth)
  ├── /api/lookup/*         → lookup.py       (public)
  └── /api/cron/*           → cron.py         (CRON_SECRET auth)
```

---

## Core Verification Model

### Claim Lifecycle

```
User adds claim
    |
    v
awaiting_org ─────────────> (org registers) ─────> awaiting_verification
    (org not on Stamp)                                      |
                                                            v
                                              ┌─────────────┼──────────────┐
                                              v             v              v
                                          verified    correction      disputed
                                                      _proposed           |
                                                          |               v
                                              ┌───────────┤    (user edits & resubmits
                                              v           v     max 5 times)
                                          verified   awaiting_          |
                                       (user accepts  verification      v
                                        corrections)  (user denies) permanently
                                                                     _locked
                                                                   (after 5 disputes)
```

**Statuses:**

| Status | Meaning |
|--------|---------|
| `awaiting_org` | Company/university not yet registered on Stamp |
| `awaiting_verification` | Verification email sent to org's HR |
| `verified` | HR confirmed the claim |
| `correction_proposed` | HR proposed corrections (user must accept or deny) |
| `disputed` | HR rejected the claim (user can edit and resubmit) |
| `expired` | No response after 30 days (user gets one resend) |
| `permanently_locked` | Disputed 5 times, no more resubmissions |

### Key Rules

- **Only HR verifies.** One authorized role-based email per org (hr@, people@, careers@).
- **Organization email = login + verifier.** The org's role-based email is used to both sign in and receive verification requests. No separate admin vs verifier distinction on the frontend.
- **Users never provide verifier emails.** Trust comes from org-level verification only.
- **Companies must come from Clearbit autocomplete.** No manual entry. Prevents fake companies.
- **No self-verification.** Org registrant cannot have claims at the same company.
- **Token is the auth.** HR clicks the verification link from email and takes action. No login required.
- **5 dispute limit.** After 5 disputes on the same claim, it locks permanently.
- **Corrections use the org's version.** If user accepts corrections, the org's data goes on the profile.
- **Verified claims are point-in-time stamps.** "As of [date], [org] confirmed this claim."
- **Public profiles only show verified claims.** Non-verified statuses are never exposed publicly.
- **`verified_by_org` is audit-only.** Stored in DB for the audit trail but not displayed on public profiles (redundant — verification always comes from the claimed org).

---

## Organization Model

### How Orgs Join

1. User adds a claim for a company not on Stamp
2. Claim goes to `awaiting_org`
3. User clicks "Invite your company" and gets an HMAC-signed invite link
4. User shares the link with HR (email, Slack, WhatsApp)
5. HR clicks link, registers org in a single form (name, domain, type, org email, password)
6. The organization email (e.g. hr@company.com) serves as both login credential and verifier email
7. All pending claims for that domain auto-link and get sent for verification

### Anti-Fraud Layers

1. **Clearbit-only companies** - no manual entry
2. **Role-based HR email only** - hr@, people@, careers@, recruiting@, talent@, registrar@, admissions@
3. **No self-verification** - registrant cannot have claims at the same company
4. **HMAC-signed invite links** - tamper-proof
5. **5 dispute limit** - prevents gaming
6. **Full audit trail** - every verification logs verifier, timestamp, org

---

## Data & Privacy

- **Delete means full delete.** Atomic PostgreSQL function wipes all user data in one transaction. No anonymized records, no ghost data.
- **Verification is point-in-time.** The verification date is stored; consumers assess recency themselves.
- **User owns their data.** They submit their own claims, org only confirms or denies.

---

## API Reference

Base URL: `https://stamp-api-qtf9.onrender.com`

### Public Endpoints (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/api/profile/{username}` | Public profile (only verified claims) |
| GET | `/api/verify/{token}` | Load claim for verification (token is auth) |
| POST | `/api/verify/{token}/verify` | Verify a claim |
| POST | `/api/verify/{token}/correct` | Propose corrections |
| POST | `/api/verify/{token}/dispute` | Dispute a claim |
| GET | `/api/invite/decode/{code}` | Decode invite link |
| GET | `/api/lookup/companies?q=` | Clearbit company search |
| GET | `/api/lookup/universities?q=` | University search |
| GET | `/api/organizations/search?q=` | Search registered orgs |

### Authenticated Endpoints (Bearer token)

**Profile:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/me` | Get own profile |
| POST | `/api/profile/` | Create profile |
| PUT | `/api/profile/me` | Update profile |
| POST | `/api/profile/avatar` | Upload avatar (multipart) |

**Employment Claims:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims/employment` | List my employment claims |
| POST | `/api/claims/employment` | Create employment claim |
| PUT | `/api/claims/employment/{id}` | Update claim (resets verification) |
| DELETE | `/api/claims/employment/{id}` | Delete claim |
| POST | `/api/claims/employment/{id}/accept-correction` | Accept org's corrections |
| POST | `/api/claims/employment/{id}/deny-correction` | Deny corrections, resubmit |
| POST | `/api/claims/employment/{id}/resend` | Resend expired verification |

**Education Claims:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims/education` | List my education claims |
| POST | `/api/claims/education` | Create education claim |
| PUT | `/api/claims/education/{id}` | Update claim |
| DELETE | `/api/claims/education/{id}` | Delete claim |
| POST | `/api/claims/education/{id}/accept-correction` | Accept corrections |
| POST | `/api/claims/education/{id}/deny-correction` | Deny corrections |
| POST | `/api/claims/education/{id}/resend` | Resend expired |

**Organizations:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/organizations/` | Register org (role-based email required) |
| GET | `/api/organizations/mine` | Get my org (admin only) |
| PUT | `/api/organizations/mine` | Update org (admin only) |
| POST | `/api/organizations/mine/logo` | Upload org logo (admin only) |

**Employer Dashboard (org admin only):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employer/claims` | Pending claims for my org |
| GET | `/api/employer/employees` | Verified employees |
| POST | `/api/employer/claims/{id}/verify?claim_type=` | Verify via dashboard |
| POST | `/api/employer/claims/{id}/correct?claim_type=` | Correct via dashboard |
| POST | `/api/employer/claims/{id}/dispute?claim_type=` | Dispute via dashboard |
| POST | `/api/employer/employees/{id}/depart` | Mark employee departed |

**Other:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invite/generate` | Generate HMAC-signed invite link |
| GET | `/api/notifications/` | User notifications |
| GET | `/api/notifications/org` | Org admin notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| PUT | `/api/notifications/{id}/read` | Mark read (scoped to user) |
| PUT | `/api/notifications/read-all` | Mark all read |
| PUT | `/api/settings/password` | Change password |
| DELETE | `/api/settings/account` | Delete account (atomic) |
| POST | `/api/cron/expire-claims` | Expire old claims (cron auth) |

### Authentication

All authenticated endpoints require a Supabase JWT in the Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

Google OAuth is the primary signup path. Email/password requires email verification.

Verification endpoints (`/api/verify/*`) require no authentication. The 32-byte cryptographic token in the URL is the auth.

---

## Project Structure

```
stampverified/
├── README.md
├── SPEC.md                          # Original product spec
├── PRODUCTMAP.md                    # Strategic source of truth
├── ROADMAP.md                       # Implementation roadmap (3 trust layers → marketplace)
├── DEPLOYMENT.md                    # Deployment & config guide
│
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 001_productmap_updates.sql
│   │   ├── 002_education_dates.sql
│   │   ├── 003_company_workspaces.sql
│   │   ├── 004_jobs.sql
│   │   ├── 005_applications.sql
│   │   ├── 006_messaging.sql
│   │   ├── 007_polish.sql
│   │   └── 008_fix_delete_function.sql
│   ├── tests/
│   │   ├── test_verification_state_machine.py
│   │   ├── test_company_workspaces.py
│   │   ├── test_jobs.py
│   │   ├── test_applications.py
│   │   ├── test_messaging.py
│   │   ├── test_url_import.py
│   │   └── test_resume_parser.py
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, routes
│       ├── config.py                # Settings (env vars, Supabase client)
│       ├── middleware/
│       │   └── auth.py              # JWT auth (ES256/JWKS) + company member auth
│       ├── models/
│       │   ├── profile.py
│       │   ├── claims.py
│       │   ├── organization.py
│       │   ├── company_member.py
│       │   ├── job.py
│       │   ├── application.py
│       │   ├── conversation.py
│       │   └── notification.py
│       ├── routes/
│       │   ├── profile.py           # Profile CRUD
│       │   ├── claims.py            # Employment + education claims
│       │   ├── verify.py            # Token-based verification (no login)
│       │   ├── organizations.py     # Org registration + validation
│       │   ├── employer.py          # Employer dashboard
│       │   ├── team.py              # Company workspace management
│       │   ├── jobs.py              # Job posting + public feed
│       │   ├── job_match.py         # Resume-to-jobs matching (Greenhouse + Stamp)
│       │   ├── applications.py      # Apply flow + saved jobs
│       │   ├── messaging.py         # Conversations + talent search
│       │   ├── companies.py         # Company directory + requests
│       │   ├── notifications.py     # Notification management
│       │   ├── invite.py            # HMAC-signed invite links
│       │   ├── settings.py          # Password + atomic account deletion
│       │   ├── lookup.py            # Clearbit + university search
│       │   └── cron.py              # Claim + job expiry automation
│       └── services/
│           ├── email.py             # Resend (6 email templates)
│           ├── notifications.py     # Preference-aware notifications
│           ├── storage.py           # Supabase Storage (avatars, logos, resumes)
│           ├── job_functions.py     # Auto-detection from titles
│           ├── jd_extract.py        # JD text extraction (regex)
│           ├── url_import.py        # ATS URL import (JSON-LD)
│           ├── job_search.py        # JSearch API (legacy, replaced by Greenhouse)
│           ├── greenhouse_scraper.py # Greenhouse API scraper (50 companies, 5,700+ jobs)
│           ├── greenhouse_matcher.py # Matching engine (hard filters + scoring)
│           ├── resume_parser.py     # Resume PDF parsing
│           └── talent_search.py     # Candidate search engine
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    └── src/
        ├── lib/
        │   ├── supabase.ts          # Supabase client
        │   └── api.ts               # Backend API client
        ├── components/
        │   ├── ClaimCard.tsx         # Employment/education cards with duration
        │   ├── StatusBadge.tsx       # Blue ✓ filled badge for verified
        │   ├── CompanyAutocomplete.tsx   # Name or domain search, gold ✓ for Stamp companies
        │   ├── UniversityAutocomplete.tsx  # With favicon logos
        │   ├── NotificationBell.tsx
        │   └── Navbar.tsx            # Role-aware + mobile hamburger menu
        └── app/
            ├── layout.tsx            # Favicon, apple-touch-icon, meta
            ├── page.tsx              # Landing page + toggle + hero card
            ├── auth/callback/        # OAuth/email redirect handler
            ├── dashboard/
            │   ├── page.tsx          # User dashboard + guided onboarding
            │   ├── settings/         # Password, notifications, delete account
            │   ├── applications/     # My applications tracking
            │   └── messages/         # Candidate messaging
            ├── employer/
            │   ├── dashboard/        # Claims, employees, quick actions
            │   ├── settings/         # Org name, email, logo, password
            │   ├── team/             # Workspace member management
            │   ├── jobs/             # Job posting + management
            │   ├── jobs/new/         # Paste-first job posting
            │   ├── applications/     # Application review + matching
            │   ├── talent/           # Talent search + outreach
            │   └── messages/         # Employer messaging
            ├── jobs/                 # Stamp Jobs / Internet Jobs toggle
            ├── jobs/[id]/            # Job detail + apply flow
            ├── companies/            # Company directory
            ├── companies/[domain]/   # Company page + jobs
            ├── match-jobs/           # Standalone resume matching
            ├── verify/[token]/       # Verification page (no login)
            ├── [username]/           # Public profile
            ├── invite/[code]/        # Invite landing page
            └── for-employers/
                ├── page.tsx          # For Employers marketing
                ├── register/         # Smart company registration/join
                └── login/            # Employer sign in
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Supabase project configured

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # fill in values
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local    # fill in values
npm run dev
```

### Run Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

### Environment Variables

**Backend (.env):**

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (keep secret) |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `RESEND_API_KEY` | Resend API key for emails |
| `FRONTEND_URL` | Frontend URL (http://localhost:3000 locally) |
| `ENVIRONMENT` | `development` or `production` |
| `INVITE_HMAC_SECRET` | Secret for signing invite links |
| `CRON_SECRET` | Auth token for cron endpoints |
| `JSEARCH_API_KEY` | RapidAPI key for JSearch (legacy, no longer required) |

**Frontend (.env.local):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | Backend API URL |

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| User auth | Supabase JWT (ES256 via JWKS), Google OAuth primary |
| Org admin auth | JWT + email matched to organization's admin_email |
| Verification auth | 32-byte cryptographic token (no login required) |
| Invite links | HMAC-SHA256 signed payloads |
| Cron auth | Dedicated bearer token (not Supabase service key) |
| Notification access | Scoped to authenticated user (user_id or org_admin_email) |
| Org registration | Role-based email validation + no self-verification check |
| Claim integrity | 5-dispute permanent lock, org is the authority |
| Account deletion | Atomic PostgreSQL function, zero data retention |
| Email | SPF/DKIM/DMARC required on domain before launch |

---

## Job Matching System

Stamp matches candidates against 5,700+ real jobs from 29 top tech companies via the Greenhouse public API.

**How it works:**

```
Candidate uploads resume (PDF)
    |
    v
Resume parser extracts: titles, skills, location, companies
    |
    v
Two-phase matching:
    |
    +-- Stamp verified jobs (from database) -- shown first with gold badge
    |
    +-- Greenhouse jobs (5,700+ from 29 companies) -- scored and ranked
        |
        Hard filters (pass/fail):
            - Location: US only or remote open to US
            - Title: engineering roles only
            - Seniority: within 1 level of candidate
            - Deal-breakers: clearance, visa restrictions
        |
        Scoring: 60% skill match + 40% keyword depth
        |
        Results with: match %, "why you matched" sentence, skill tags
```

**Companies included:**
Airbnb, Stripe, Figma, Discord, Cloudflare, Databricks, Datadog, Twitch, Coinbase, Robinhood, Instacart, Pinterest, Reddit, Brex, Airtable, Vercel, GitLab, Elastic, MongoDB, Cockroach Labs, PlanetScale, LaunchDarkly, Postman, Twilio, Algolia, Grafana Labs, ClickHouse, dbt Labs, Fivetran

**Refresh job data:**
```bash
cd backend
python -m app.services.greenhouse_scraper
```

**Features:**
- Match scores (0-100%) with color-coded circles
- Toggleable skill tags — click to enable/disable skills, add missing ones
- Experience level selector (Early career / Mid / Senior)
- Filters: Best matches / All jobs / Remote only
- Click to expand: "Why you matched" + description snippet + matched skill tags
- Company logos via Google favicon API
- Salary display when available
- "Update matches" button after editing skills or level
- Stamp verified jobs appear first with gold badge
- No external API dependencies (Greenhouse public API, no key needed)

---

## Business Model

**Year 1: Free.** Build the trust layer. Target: 20 university partnerships, 100+ companies, 50,000+ verified claims.

**Year 2: Marketplace.** Recruiter seats ($49-99/month). Premium employer dashboard ($29/month).

**Year 3+: Data business.** B2B verification API ($0.50-2/query). Real-time employment status API for lenders ($2-5/query). Verified salary intelligence.

### Revenue Opportunities

| Product | Price | Market |
|---------|-------|--------|
| B2B verification API | $0.50-2/query | $4.5B background check industry |
| Employment status API | $2-5/query | Mortgage, auto loans, credit |
| Recruiter seats | $49-99/month | Replaces $800+/month LinkedIn Recruiter |
| Verified salary intelligence | $10K+/year | HR teams, compensation consultants |
| "Sign in with Stamp" | Per-check fee | Job boards, freelance marketplaces |

### North Star Metric

**Verification rate** - percentage of submitted claims that get verified. Target: 60%+.

---

## Go-to-Market

1. **Universities first (Months 0-6)** - registrar offices already handle verification. One partnership = thousands of verified degrees.
2. **Employers via grad traction (Months 6-12)** - verified grad base attracts employers. Track which companies have the most `awaiting_org` claims.
3. **Trusted marketplace (Months 12-18)** - verified candidates meet verified employers. Recruiter seats launch.
4. **B2B data business (Month 18+)** - verification API. FCRA compliance required.

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

## Comparable Exits

| Company | Outcome | What they built |
|---------|---------|-----------------|
| Truework | ~$480M acquisition by Checkr | Employment verification API |
| Checkr | $5B valuation | Background checks |
| Sterling | $2.8B acquisition | Background checks |
| Plaid | $13.4B valuation | Financial identity layer |

Stamp is building the identity layer for professional data.

---

## License

Proprietary. All rights reserved.
