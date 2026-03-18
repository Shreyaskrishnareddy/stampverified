# Stamp — Deployment & Configuration Guide

> Last updated: 2026-03-17

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Frontend (Next.js) │────▶│  Backend (FastAPI)    │────▶│   Supabase       │
│   Vercel             │     │  Render               │     │   (Auth + DB)    │
│   stampverified.com  │     │  stamp-api-qtf9.      │     │   yzpdxtzsasi... │
│                      │     │  onrender.com         │     │                  │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │   Resend          │
                              │   (Email service) │
                              └──────────────────┘
```

### Stack

| Layer      | Technology                    | Hosting      | Status        |
|------------|-------------------------------|--------------|---------------|
| Frontend   | Next.js 16 + Tailwind CSS v4  | Vercel       | Deployed      |
| Backend    | FastAPI + Uvicorn             | Render       | Deployed      |
| Database   | PostgreSQL                    | Supabase     | Deployed      |
| Auth       | Supabase Auth                 | Supabase     | Configured    |
| Email      | Resend                        | Resend.com   | Configured    |
| DNS        | stampverified.com             | Namecheap    | Verified      |
| Jobs API   | JSearch (RapidAPI)            | RapidAPI     | Configured    |

---

## Services & Accounts

### 1. Vercel (Frontend)

- **Project**: stampweb
- **Production URL**: https://stampverified.com
- **Root directory**: `frontend`
- **Auto-deploy**: On push to `main`

#### Environment Variables (Vercel)

| Variable                       | Status      |
|--------------------------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | Set         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Set         |
| `NEXT_PUBLIC_API_URL`          | Set         |

### 2. Render (Backend)

- **Service**: stamp-api
- **URL**: https://stamp-api-qtf9.onrender.com
- **Root directory**: `backend`
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Auto-deploy**: On push to `main`

#### Environment Variables (Render)

| Variable                | Status      |
|-------------------------|-------------|
| `SUPABASE_URL`          | Set         |
| `SUPABASE_SERVICE_KEY`  | Set         |
| `SUPABASE_JWT_SECRET`   | Set         |
| `RESEND_API_KEY`        | Set         |
| `FRONTEND_URL`          | Set         |
| `ENVIRONMENT`           | Set (`production`) |
| `PYTHON_VERSION`        | Set (`3.11.0`) |
| `JSEARCH_API_KEY`       | Set         |
| `CRON_SECRET`           | Set         |
| `INVITE_HMAC_SECRET`    | Set         |

### 3. Supabase (Auth + Database)

- **Project**: stamp
- **URL**: https://yzpdxtzsasipukeoxuet.supabase.co

#### Auth Configuration

| Setting                  | Status                                   |
|--------------------------|------------------------------------------|
| Email provider           | Enabled                                  |
| Google OAuth             | Enabled                                  |
| Confirm email            | Check Supabase dashboard — enable for production |
| Site URL                 | `https://www.stampverified.com`           |
| Redirect URLs            | `stampverified.com/auth/callback`, `www.stampverified.com/auth/callback`, `stampweb.vercel.app/auth/callback` |

#### Database Migrations

10 migrations total. Run in Supabase SQL Editor in order:

| Migration | Description | Status |
|-----------|-------------|--------|
| 001_initial_schema | Profiles, claims, notifications | Applied |
| 001_productmap_updates | Schema updates | Applied |
| 002_education_dates | Education date fields | Applied |
| 003_company_workspaces | company_members table, permissions | Applied |
| 004_jobs | Jobs table, job_functions | Applied |
| 005_applications | Applications, saved_jobs | Applied |
| 006_messaging | Conversations, messages | Applied |
| 007_polish | Polish updates | Applied |
| 008_fix_delete_function | delete_user_account() update | Applied |
| **009_verification_hardening** | audit_logs, token_expires_at, pending status | **Run this** |
| **010_trust_policy** | blocked_companies, DNS verification fields | **Run this** |

### 4. Resend (Email)

- **Status**: Configured and working
- **API key**: Set in Render as `RESEND_API_KEY`
- **Domain**: stampverified.com (verified)
- **Sending addresses**: `verify@stampverified.com`, `hello@stampverified.com`, `notifications@stampverified.com`

### 5. DNS (Namecheap)

| Type   | Host  | Value                                         | Purpose              |
|--------|-------|-----------------------------------------------|----------------------|
| A      | @     | 76.76.21.21                                   | Vercel               |
| CNAME  | www   | cname.vercel-dns.com                          | Vercel               |
| TXT    | @     | stamp-verify=...                              | Domain verification  |
| TXT    | @     | v=spf1 include:spf.efwd.registrar-servers.com | Email SPF            |

### 6. GitHub

- **Repository**: https://github.com/Shreyaskrishnareddy/stampverified
- **Branch**: main
- **Visibility**: Should be private (OP.1 in TODO)

---

## Project Structure

```
stampverified/
├── TODO.md                              # Master task list with priorities
├── VERIFICATION_TODO.md                 # Trust architecture audit + plan
├── DEPLOYMENT.md                        # This file
│
├── backend/
│   ├── requirements.txt                 # Python dependencies (includes dnspython)
│   ├── app/
│   │   ├── main.py                      # FastAPI app, CORS, route registration
│   │   ├── config.py                    # Settings (pydantic-settings)
│   │   ├── middleware/
│   │   │   └── auth.py                  # JWT auth, require_permission, require_domain_verified
│   │   ├── models/
│   │   │   ├── claims.py               # Claim models (employment + education)
│   │   │   ├── organization.py         # Organization models
│   │   │   ├── company_member.py       # Workspace member models
│   │   │   ├── job.py                  # Job posting models
│   │   │   ├── conversation.py         # Messaging models
│   │   │   ├── application.py          # Application models
│   │   │   ├── profile.py             # Profile models
│   │   │   └── notification.py        # Notification models
│   │   ├── routes/
│   │   │   ├── profile.py             # Candidate profiles
│   │   │   ├── claims.py              # Employment + education claims
│   │   │   ├── verify.py             # Token-based verification (no login)
│   │   │   ├── organizations.py       # Org registration + DNS verification
│   │   │   ├── employer.py           # Employer claim verification dashboard
│   │   │   ├── team.py              # Workspace members, invites, approve/deny
│   │   │   ├── jobs.py              # Job posting + browsing
│   │   │   ├── job_match.py         # Resume → job matching (JSearch)
│   │   │   ├── applications.py      # Job applications
│   │   │   ├── messaging.py         # Outreach, conversations, block/unblock
│   │   │   ├── companies.py         # Company directory
│   │   │   ├── notifications.py     # In-app notifications
│   │   │   ├── settings.py          # Password change, account deletion
│   │   │   ├── invite.py            # Org invite links
│   │   │   ├── lookup.py            # Clearbit + HIPO autocomplete
│   │   │   └── cron.py              # Claim + job expiry (scheduled)
│   │   └── services/
│   │       ├── email.py             # Resend templates (7 email types)
│   │       ├── audit.py             # Audit logging service
│   │       ├── talent_search.py     # Verified candidate search engine
│   │       ├── notifications.py     # In-app + email notification dispatch
│   │       ├── job_search.py        # JSearch API client (cached, quota-tracked)
│   │       ├── resume_parser.py     # Resume text extraction + parsing
│   │       ├── job_functions.py     # Job function taxonomy
│   │       ├── jd_extract.py        # Job description field extraction
│   │       ├── url_import.py        # ATS URL import (Greenhouse/Lever/Ashby)
│   │       ├── storage.py           # Supabase Storage (logos, resumes)
│   │       └── trust_score.py       # Trust score calculation
│   ├── migrations/                    # 10 SQL migrations
│   └── tests/                         # 174 tests
│
└── frontend/
    └── src/
        ├── lib/
        │   ├── supabase.ts            # Supabase client
        │   └── api.ts                 # Backend API client (all endpoints)
        ├── components/
        │   ├── Navbar.tsx             # Navigation (candidate + employer modes)
        │   ├── ClaimCard.tsx          # Employment/Education claim cards
        │   ├── StatusBadge.tsx        # Claim status badges
        │   ├── CompanyAutocomplete.tsx # Clearbit company search
        │   ├── UniversityAutocomplete.tsx # HIPO university search
        │   └── NotificationBell.tsx   # In-app notification dropdown
        └── app/
            ├── page.tsx               # Landing page + auth modal
            ├── layout.tsx             # Root layout, meta, fonts
            ├── auth/callback/         # OAuth/email callback
            ├── dashboard/             # Candidate dashboard, messages, settings
            ├── [username]/            # Public profiles (dynamic OG images)
            ├── jobs/                  # Job browsing + detail
            ├── match-jobs/            # Resume → job matching
            ├── companies/             # Company directory
            ├── employer/              # Employer dashboard, jobs, team, talent, settings
            ├── for-employers/         # Employer registration + login
            ├── verify/[token]/        # Token-based claim verification
            └── invite/                # Org invite acceptance
```

---

## Security & Trust Model

### Implemented Protections

| Protection | Implementation |
|------------|---------------|
| **Org registration** | Registrant email domain must match org domain. Public email domains blocked. |
| **Workspace auth** | All access via company_members table. Legacy admin_email fallback removed. |
| **Self-join approval** | Domain match creates `status=pending`. Admin must approve. |
| **Domain verification** | DNS TXT verification for premium trust actions. Self-service flow. |
| **is_domain_verified enforcement** | Required for: job posting, claim verification, talent search, outreach, company directory. |
| **Token TTL** | 30-day expiry on verification tokens. 410 response for expired links. |
| **Candidate trust gating** | 1+ verified claim required to: apply, enter recruiter pool, receive outreach. |
| **Outreach anti-abuse** | Per-org-per-candidate 7-day cooldown, duplicate prevention, volume logging. No hard daily cap. |
| **Candidate block** | Candidates can block companies from contacting them or seeing them in search. |
| **Audit logging** | audit_logs table records verification, permission, and member actions. |
| **Claim rate limit** | Max 10 pending claims per user. |
| **Email verification** | Supabase email_confirmed_at checked before workspace join. |
| **Redirect sanitization** | `next` param must start with `/` and not `//`. |
| **Verifier email policy** | Must be organizational address (hr@, people@, founder@, admin@, etc.). Personal names rejected. |

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Fill in values
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Run Tests
```bash
cd backend
python -m pytest tests/ -q    # 174 tests
```

---

## Deployment

1. Commit and push to `main`
2. Vercel auto-deploys frontend (~30s)
3. Render auto-deploys backend (~2-3min)

### After code deploy, run new migrations

If migrations 009 or 010 haven't been run yet:
1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `backend/migrations/009_verification_hardening.sql` → Run
3. Paste contents of `backend/migrations/010_trust_policy.sql` → Run

---

## Remaining Tasks

### Before Public Launch
- [ ] Enable "Confirm email" in Supabase Auth settings (if not already)
- [ ] Privacy Policy + Terms of Service pages
- [ ] Make GitHub repo private

### Recommended
- [ ] Upgrade Render to paid plan ($7/mo) — removes cold starts
- [ ] Set up Sentry for error monitoring
- [ ] Add rate limiting on public verification endpoints (defense-in-depth)
- [ ] Add sitemap.xml and robots.txt

---

## Troubleshooting

### Vercel build fails
- Check for TypeScript errors: `cd frontend && npx tsc --noEmit`
- Ensure all new types match backend response shapes

### Render deploy doesn't pick up new dependencies
- Go to Render Dashboard → service → Settings → "Clear build cache & deploy"

### DNS verification "Check" button fails
- Ensure `dnspython` is installed (in requirements.txt)
- If Render cached old deps, clear build cache and redeploy
- Check DNS propagation at dnschecker.org

### Backend cold starts (30s delay)
- Render free tier spins down after 15min inactivity
- Upgrade to paid ($7/mo) or ping `/health` every 14 min via cron-job.org

### CORS errors
- Backend CORS allows `FRONTEND_URL` + `http://localhost:3000`
- Ensure `FRONTEND_URL=https://stampverified.com` on Render
