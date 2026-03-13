# Stamp — Deployment & Configuration Guide

## Overview

**Stamp** (stampverified.com) is a verified professional identity platform where employers and universities confirm career claims via email. Every claim on a user's profile is confirmed by the source — no fake profiles, just proof.

---

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

| Layer      | Technology         | Hosting      | URL                                      |
|------------|--------------------|--------------|------------------------------------------|
| Frontend   | Next.js 16 + Tailwind CSS v4 | Vercel | https://stampverified.com               |
| Backend    | FastAPI + Uvicorn  | Render       | https://stamp-api-qtf9.onrender.com      |
| Database   | PostgreSQL         | Supabase     | https://yzpdxtzsasipukeoxuet.supabase.co |
| Auth       | Supabase Auth      | Supabase     | Google OAuth + Email/Password            |
| Email      | Resend             | Resend.com   | Not yet configured                       |
| Domain     | stampverified.com  | Namecheap    | DNS pointed to Vercel                    |

---

## Services & Accounts

### 1. Vercel (Frontend Hosting)

- **Account**: shreyas.skr82@gmail.com
- **Project name**: stampweb
- **Dashboard**: https://vercel.com/shreyaskrishnareddys-projects/stampweb
- **Preview URL**: https://stampweb.vercel.app
- **Production URL**: https://stampverified.com
- **Root directory**: `frontend`
- **Framework**: Next.js (auto-detected)
- **Node version**: 24.x
- **Auto-deploy**: On push to `main` branch

#### Environment Variables (Vercel)

| Variable                       | Value                                              |
|--------------------------------|----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | `https://yzpdxtzsasipukeoxuet.supabase.co`         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| `eyJhbGci...BCzvijaBNr2Fi0M8YIXQwB0DhDzovUIKHu7X_yqEMLo` |
| `NEXT_PUBLIC_API_URL`          | `https://stamp-api-qtf9.onrender.com`              |

### 2. Render (Backend Hosting)

- **Account**: shreyas.skr82@gmail.com
- **Service name**: stamp-api
- **URL**: https://stamp-api-qtf9.onrender.com
- **Root directory**: `backend`
- **Runtime**: Python 3.11
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Auto-deploy**: On push to `main` branch

#### Environment Variables (Render)

| Variable               | Value                                              |
|------------------------|----------------------------------------------------|
| `SUPABASE_URL`         | `https://yzpdxtzsasipukeoxuet.supabase.co`         |
| `SUPABASE_SERVICE_KEY`  | *(service role key — keep secret)*                |
| `SUPABASE_JWT_SECRET`   | *(JWT secret — keep secret)*                      |
| `RESEND_API_KEY`        | *(empty — not yet configured)*                    |
| `FRONTEND_URL`          | `https://stampverified.com`                        |
| `ENVIRONMENT`           | `production`                                       |
| `PYTHON_VERSION`        | `3.11.0`                                           |

> **Note**: Render free tier spins down after 15 minutes of inactivity. First request after idle takes ~30 seconds. Upgrade to paid instance ($7/mo) to keep it always on.

### 3. Supabase (Auth + Database)

- **Account**: shreyas.skr82@gmail.com
- **Project**: stamp
- **Region**: (check Supabase dashboard)
- **URL**: https://yzpdxtzsasipukeoxuet.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/yzpdxtzsasipukeoxuet

#### Auth Configuration

| Setting                  | Value                                    |
|--------------------------|------------------------------------------|
| **Email provider**       | Enabled                                  |
| **Google OAuth**         | Enabled                                  |
| **Confirm email**        | **Must enable before launch** — required for email/password signups per PRODUCTMAP |
| **User signups**         | Allowed                                  |
| **Site URL**             | `https://www.stampverified.com`           |
| **Redirect URLs**        | `https://www.stampverified.com/auth/callback`, `https://stampverified.com/auth/callback`, `https://stampweb.vercel.app/auth/callback` |

#### Database Tables

The backend manages these tables via Supabase:

- **profiles** — user profiles (username, full_name, headline, location, avatar_url, trust_score)
- **employment_claims** — job claims (company, title, department, dates, status, verifier_email)
- **education_claims** — education claims (institution, degree, field, years, status, verifier_email)
- **verification_tokens** — tokens sent to verifiers via email

### 4. Namecheap (Domain)

- **Domain**: stampverified.com
- **DNS Records**:

| Type   | Host  | Value                  |
|--------|-------|------------------------|
| A      | @     | 76.76.21.21            |
| CNAME  | www   | cname.vercel-dns.com   |

### 5. GitHub (Source Code)

- **Repository**: https://github.com/Shreyaskrishnareddy/stampverified
- **Branch**: main
- **Git email**: shreyas.skr82@gmail.com (must match for Vercel auto-deploy)

### 6. Resend (Email — NOT YET CONFIGURED)

To enable verification emails:

1. Sign up at https://resend.com (free = 100 emails/day)
2. Go to **API Keys** → **Create API Key** → copy key (starts with `re_...`)
3. Add it to Render as `RESEND_API_KEY`
4. Go to **Domains** → **Add Domain** → `stampverified.com`
5. Add the DNS records Resend provides to Namecheap (TXT, MX records)
6. Once verified, emails will send from `verify@stampverified.com`

---

## Project Structure

```
stamp/
├── .gitignore
├── SPEC.md                          # Original project specification
├── DEPLOYMENT.md                    # This file
├── render.yaml                      # Render deployment config
│
├── backend/
│   ├── .env                         # Local env (not committed)
│   ├── .env.example                 # Template for env vars
│   ├── .env.render                  # Production env (not committed)
│   ├── .python-version              # Pin Python 3.11 for Render
│   ├── requirements.txt             # Python dependencies
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, routes
│       ├── config.py                # Settings (pydantic-settings)
│       ├── middleware/
│       │   └── auth.py              # JWT auth middleware (ES256/JWKS)
│       ├── models/
│       │   ├── profile.py           # Profile Pydantic models
│       │   └── claims.py            # Claim Pydantic models
│       ├── routes/
│       │   ├── profile.py           # /api/profile/* endpoints
│       │   ├── claims.py            # /api/claims/* endpoints
│       │   └── verify.py            # /api/verify/* endpoints
│       └── services/
│           ├── email.py             # Resend email service
│           └── trust_score.py       # Trust score calculation
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── postcss.config.mjs
    └── src/
        ├── lib/
        │   ├── supabase.ts          # Supabase client (implicit flow)
        │   └── api.ts               # Backend API client
        ├── components/
        │   ├── ClaimCard.tsx         # Employment/Education claim cards
        │   └── StatusBadge.tsx       # Verified/Pending/Rejected badges
        └── app/
            ├── layout.tsx           # Root layout, meta, fonts
            ├── globals.css          # All animations & custom CSS
            ├── page.tsx             # Landing page + Auth modal
            ├── not-found.tsx        # Custom 404 page
            ├── auth/
            │   └── callback/
            │       └── page.tsx     # OAuth/email callback handler
            ├── dashboard/
            │   └── page.tsx         # Authenticated dashboard
            └── profile/
                └── [username]/
                    ├── page.tsx     # Public profile page
                    ├── layout.tsx   # Dynamic SEO meta tags
                    └── opengraph-image.tsx  # Dynamic OG image (edge)
```

---

## Authentication Flow

### Google OAuth
1. User clicks "Continue with Google"
2. Redirected to Google → grants permission
3. Redirected back to `/auth/callback` with tokens in URL hash
4. Supabase client parses tokens, establishes session
5. User redirected to `/dashboard`

### Email/Password
1. **Sign up**: User enters email + password → account created → signed in immediately (confirm email is off)
2. **Sign in**: User enters email + password → authenticated → redirected to `/dashboard`
3. **Forgot password**: User enters email → reset link sent → user clicks link → redirected to `/auth/callback` → can set new password

---

## API Endpoints

### Public
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/`                          | API info                       |
| GET    | `/health`                    | Health check                   |
| GET    | `/api/profile/{username}`    | Public profile + claims        |
| POST   | `/api/verify/{token}`        | Verify a claim (external)      |

### Authenticated (requires Bearer token)
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/api/profile/me`            | Get own profile                |
| POST   | `/api/profile`               | Create profile                 |
| PUT    | `/api/profile/me`            | Update profile                 |
| GET    | `/api/claims/employment`     | List employment claims         |
| POST   | `/api/claims/employment`     | Create employment claim        |
| DELETE | `/api/claims/employment/{id}`| Delete employment claim        |
| GET    | `/api/claims/education`      | List education claims          |
| POST   | `/api/claims/education`      | Create education claim         |
| DELETE | `/api/claims/education/{id}` | Delete education claim         |

---

## Local Development

### Prerequisites
- Node.js 20+ (use `nvm use 20`)
- Python 3.11+
- Supabase account with project configured

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Fill in your values
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local    # Fill in your values
npm run dev
```

### Environment Variables (Local)

**backend/.env**
```
SUPABASE_URL=https://yzpdxtzsasipukeoxuet.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
RESEND_API_KEY=
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
```

**frontend/.env.local**
```
NEXT_PUBLIC_SUPABASE_URL=https://yzpdxtzsasipukeoxuet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Deployment Workflow

1. Make changes locally
2. Test with `npm run build` in frontend
3. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "your message"
   git push
   ```
4. **Vercel** auto-deploys frontend (takes ~30-40s)
5. **Render** auto-deploys backend (takes ~2-3min)

### Important Git Config
```bash
git config user.email "shreyas.skr82@gmail.com"
```
Must match your GitHub account email, otherwise Vercel blocks the deployment on the Hobby plan.

---

## Remaining Setup Tasks

### Must Do
- [ ] **Set up Resend** — verification emails won't send without this
  - Sign up at resend.com
  - Create API key, add to Render env vars
  - Verify domain (add DNS records to Namecheap)

### Recommended
- [ ] **Enable "Confirm email"** in Supabase once you go public
- [ ] **Upgrade Render** to paid plan ($7/mo) to avoid cold starts
- [ ] **Add Google OAuth credentials for production** — verify redirect URIs in Google Cloud Console include `https://yzpdxtzsasipukeoxuet.supabase.co/auth/v1/callback`
- [ ] **Set up error monitoring** — consider Sentry for both frontend and backend
- [ ] **Add rate limiting** on the backend to prevent abuse
- [ ] **Enable Vercel Analytics** — free, one-click in Vercel dashboard

### Nice to Have
- [ ] **Custom email templates** in Supabase (Auth → Email Templates) for branded confirmation/reset emails
- [ ] **Profile photo uploads** via Supabase Storage
- [ ] **LinkedIn import** — auto-fill claims from LinkedIn profile
- [ ] **Admin dashboard** — view all users, claims, verification stats
- [ ] **Notification system** — email users when a claim is verified
- [ ] **SEO** — add sitemap.xml, robots.txt
- [ ] **PWA** — make it installable on mobile

---

## Troubleshooting

### Vercel deployment blocked
- Ensure `git config user.email` matches your GitHub account email (`shreyas.skr82@gmail.com`)

### Render build fails with pydantic-core error
- Ensure `PYTHON_VERSION=3.11.0` is set in Render environment variables
- The `.python-version` file in `backend/` should also pin 3.11.0

### Backend cold starts (30s delay)
- Render free tier spins down after 15min inactivity
- Upgrade to paid ($7/mo) or use a cron job to ping `/health` every 14 min

### Google OAuth not redirecting properly
- Ensure Supabase redirect URLs include both `www.stampverified.com` and `stampverified.com` variants
- Check Google Cloud Console → OAuth consent screen → authorized redirect URIs

### CORS errors
- Backend CORS allows `FRONTEND_URL` env var value + `http://localhost:3000`
- Ensure `FRONTEND_URL=https://stampverified.com` on Render

---

## Key Design Decisions

- **Sky blue color scheme** — all UI uses sky-400/500/600, no purple/violet/indigo
- **Blue tick badge** — the filled verification badge SVG is used as the brand logo everywhere
- **Brand name** — always "Stamp" (capitalized), never "stamp"
- **3D tilt card** — hero card follows mouse with perspective transform, disabled on touch devices
- **Animated gradient border** — uses CSS mask compositing with sky-only colors
- **No TrustScoreRing** — replaced with simple "X of Y verified" counts
- **Implicit OAuth flow** — tokens in URL hash, no server-side token exchange needed
- **Edge OG images** — dynamic social sharing images rendered at the edge for each profile
