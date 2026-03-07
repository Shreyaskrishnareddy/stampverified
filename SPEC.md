# Stamp — MVP Product Spec

> Your career, verified.
> Anyone can claim it. Stamp proves it.

## What is Stamp?

A platform where every professional claim (job, education) is verified by the source.
You add a claim, the employer/university confirms it, a verified badge appears on your profile.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Frontend | Next.js (React) + Tailwind CSS |
| Email | Resend (verification request emails) |
| File Storage | Supabase Storage (avatars, resumes) |
| Deployment | Vercel (frontend) + Render (backend) |

## MVP Scope (v1)

### What ships:
- [x] Google OAuth signup/login via Supabase Auth
- [ ] Profile creation (name, headline, location, avatar)
- [ ] Add employment claims (company name, title, department, dates, employment type)
- [ ] Add education claims (institution, degree, field, year)
- [ ] Verification email sent to employer/university contact for each claim
- [ ] Secure verification link — recipient can Verify or Dispute
- [ ] Verified/Disputed/Pending badge on each claim
- [ ] Trust score (percentage of verified claims)
- [ ] Public profile page (stamp.app/username or stamp.app/u/uuid)
- [ ] Clean, minimal UI

### What does NOT ship in v1:
- No resume parser
- No skill endorsements
- No company admin portal (just email link verification)
- No recruiter search
- No job matching
- No salary data
- No B2B API
- No payments

## Database Schema (v1 — Supabase PostgreSQL)

### users
Managed by Supabase Auth. Extended with a `profiles` table.

### profiles
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    headline VARCHAR(500),
    location VARCHAR(255),
    avatar_url TEXT,
    trust_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### employment_claims
```sql
CREATE TABLE employment_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    employment_type VARCHAR(50) DEFAULT 'full_time',
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    verifier_email VARCHAR(255),
    verification_token VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP,
    disputed_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### education_claims
```sql
CREATE TABLE education_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    field_of_study VARCHAR(255),
    year_started INTEGER,
    year_completed INTEGER,
    verifier_email VARCHAR(255),
    verification_token VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP,
    disputed_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Claim Statuses
- `pending` — claim submitted, verification email sent, awaiting response
- `verified` — verifier confirmed the claim
- `disputed` — verifier rejected the claim (reason stored)
- `expired` — no response after 30 days

## Trust Score (v1 — simple)
```
trust_score = (verified_claims / total_claims) * 100
```
Display tiers:
- 90-100 — "Fully Verified" (green badge)
- 70-89 — "Mostly Verified" (blue badge)
- 40-69 — "Partially Verified" (grey badge)
- 0-39 — "Unverified" (no badge)

## Verification Flow
```
1. User signs up (Google OAuth)
2. User creates profile (name, headline, location)
3. User adds employment claim (company, title, dates)
4. User enters verifier email (HR contact, manager, registrar)
5. System sends email: "[User] claims [Title] at [Company]. Verify?"
6. Email contains secure link with verification_token
7. Verifier clicks link -> sees claim details
8. Verifier clicks [Verify] or [Dispute]
9. Claim status updates, trust score recalculates
10. Badge appears on user's public profile
```

## API Endpoints (FastAPI)

### Auth
- `POST /auth/callback` — handle Supabase OAuth callback

### Profile
- `GET /api/profile/{username}` — public profile (no auth needed)
- `GET /api/profile/me` — current user profile
- `PUT /api/profile/me` — update profile
- `POST /api/profile/avatar` — upload avatar

### Employment Claims
- `GET /api/claims/employment` — list my employment claims
- `POST /api/claims/employment` — add employment claim + send verification email
- `PUT /api/claims/employment/{id}` — edit claim (only if pending)
- `DELETE /api/claims/employment/{id}` — delete claim

### Education Claims
- `GET /api/claims/education` — list my education claims
- `POST /api/claims/education` — add education claim + send verification email
- `PUT /api/claims/education/{id}` — edit claim (only if pending)
- `DELETE /api/claims/education/{id}` — delete claim

### Verification (no auth — token-based)
- `GET /api/verify/{token}` — show claim details for verifier
- `POST /api/verify/{token}/confirm` — verifier confirms claim
- `POST /api/verify/{token}/dispute` — verifier disputes claim (with reason)

## Project Structure

```
stamp/
  backend/
    app/
      main.py              # FastAPI app
      config.py            # env vars, Supabase client
      models/
        profile.py
        employment.py
        education.py
      routes/
        auth.py
        profile.py
        claims.py
        verify.py
      services/
        email.py           # Resend integration
        trust_score.py     # score calculation
      middleware/
        auth.py            # Supabase JWT verification
    requirements.txt
    Dockerfile
  frontend/
    src/
      app/
        page.tsx           # landing page
        login/page.tsx
        dashboard/page.tsx
        profile/[username]/page.tsx  # public profile
        verify/[token]/page.tsx      # verification page
      components/
        ClaimCard.tsx
        ProfileHeader.tsx
        TrustBadge.tsx
        VerificationForm.tsx
      lib/
        supabase.ts
        api.ts
    package.json
    tailwind.config.ts
  SPEC.md
  README.md
```

## Pages

### 1. Landing Page (/)
- Hero: "Your career, verified."
- Subtext: "Every claim on your profile is confirmed by the source. No fake profiles. Just proof."
- [Sign up with Google] button
- Example profile preview showing verified badges

### 2. Dashboard (/dashboard)
- Profile summary with trust score
- Employment claims list with status badges
- Education claims list with status badges
- [Add Employment] [Add Education] buttons

### 3. Public Profile (/profile/[username])
- Name, headline, location, avatar
- Trust score badge
- Employment history with verification status on each
- Education history with verification status on each
- Shareable URL

### 4. Verification Page (/verify/[token])
- No login required
- Shows: "[User] claims they worked as [Title] at [Company] from [Date] to [Date]"
- Two buttons: [Verify This Claim] [Dispute This Claim]
- If dispute: text field for reason
- Thank you screen after action

## Environment Variables

### Backend
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
RESEND_API_KEY=
FRONTEND_URL=
```

### Frontend
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

## Design Principles
- Apple-like design. Generous whitespace. Clean typography. Subtle animations.
- Color palette: white/off-white backgrounds, black text, minimal accent colors.
- Font: Inter (or system font stack). No decorative fonts.
- The badge IS the product. Make it visually prominent but elegant.
- Green check = verified. Red x = disputed. Grey clock = pending.
- Cards with subtle shadows, rounded corners, no heavy borders.
- Public profiles should look clean enough to share on a resume or LinkedIn.
- Mobile-responsive from day 1.
- No clutter. Every element earns its place. If it doesn't serve verification, remove it.
- Transitions: subtle fade-ins, smooth state changes. Nothing flashy.
- Dark mode support (later, not v1).

## Context for Claude

This document is the single source of truth for the Stamp MVP.
If conversation context is lost, read this file first, then read the codebase.

### Current Build Status (as of 2026-03-07)

**COMPLETED:**
1. Supabase project created and configured
   - Project URL: https://yzpdxtzsasipukeoxuet.supabase.co
   - Google OAuth enabled
   - Database tables created (profiles, employment_claims, education_claims)
   - API keys and JWT secret configured in backend/.env
2. Backend (FastAPI) — FULLY BUILT, all files written:
   - `backend/app/main.py` — FastAPI app with CORS, routes mounted
   - `backend/app/config.py` — Supabase client, settings from .env
   - `backend/app/middleware/auth.py` — JWT verification for protected routes
   - `backend/app/models/profile.py` — Pydantic models for profile CRUD
   - `backend/app/models/claims.py` — Pydantic models for employment/education claims
   - `backend/app/routes/profile.py` — Profile CRUD + public profile endpoint
   - `backend/app/routes/claims.py` — Employment + education claims CRUD with verification email
   - `backend/app/routes/verify.py` — Token-based verification (verify/dispute claims)
   - `backend/app/services/email.py` — Resend email service for verification emails
   - `backend/app/services/trust_score.py` — Trust score calculation
   - `backend/requirements.txt` — All Python dependencies
   - `backend/.env` — Configured with Supabase credentials (RESEND_API_KEY still empty)
   - `backend/.env.example` — Template for env vars

**NOT YET STARTED:**
3. Frontend (Next.js + React + Tailwind) — needs to be built from scratch
   - Node.js 20 is available via nvm: `export NVM_DIR="/home/great/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use --delete-prefix v20.20.1`
   - A bare `frontend/` directory exists with package.json but NO Next.js setup yet
   - Need to: set up Next.js project, create all pages, components, Supabase client, API client
   - Frontend .env not yet created

**WHAT TO DO NEXT (in order):**
1. Set up the Next.js frontend properly (create-next-app or manual setup)
2. Create frontend/.env.local with Supabase keys
3. Create Supabase client helper (src/lib/supabase.ts)
4. Create API client helper (src/lib/api.ts)
5. Build pages:
   - Landing page (/) — hero, sign up button
   - Auth callback (/auth/callback) — handle OAuth redirect
   - Dashboard (/dashboard) — profile + claims management
   - Public profile (/profile/[username]) — shareable verified profile
   - Verification page (/verify/[token]) — for email recipients to verify/dispute
6. Build components: ClaimCard, ProfileHeader, TrustBadge, VerificationForm
7. Style everything with Tailwind — Apple-like minimal design
8. Test backend locally: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
9. Test frontend locally: `cd frontend && npm run dev`
10. Deploy: Render (backend) + Vercel (frontend)

**IMPORTANT NOTES:**
- Backend .env has real Supabase credentials — do NOT commit to git
- Google OAuth Client ID: 746203776253-0rjru0uvinko12q7b09envd58nuv4ksm.apps.googleusercontent.com
- Supabase callback URL: https://yzpdxtzsasipukeoxuet.supabase.co/auth/v1/callback
- RESEND_API_KEY is empty — user needs to sign up at resend.com and add the key
- Design: Apple-like, minimal, generous whitespace, Inter font, subtle shadows

## Build Order
1. Set up project structure (backend + frontend)
2. Supabase project + database tables
3. Backend: auth middleware, profile CRUD
4. Backend: claims CRUD + verification email
5. Backend: verification endpoints (confirm/dispute)
6. Backend: trust score calculation
7. Frontend: landing page + auth
8. Frontend: dashboard (profile + claims management)
9. Frontend: public profile page
10. Frontend: verification page (for email recipients)
11. Deploy: Render (backend) + Vercel (frontend)
12. Test end-to-end flow

---

## Future Roadmap (Post-MVP)

### Phase 2: Core Platform
- [ ] Resume upload + auto-populate profile (resume parser via LLM)
- [ ] Skill taxonomy (canonical skill IDs, normalization)
- [ ] Company org accounts (company signs up, claims admin role)
- [ ] Company admin portal (verify/dispute claims in bulk, manage employees)
- [ ] Company verification (corporate email domain or business docs)
- [ ] Verified company badge on profiles and job postings

### Phase 3: Skill Endorsements
- [ ] Manager/colleague-only endorsements (not random connections)
- [ ] Endorsements tied to verified employment (you can only endorse someone you worked with)
- [ ] Skill display: "Python — endorsed by 2 managers, 4 colleagues across 3 verified employers"

### Phase 4: Matching & Jobs
- [ ] Resume-to-JD matching engine (skill overlap, gap analysis)
- [ ] ATS scoring endpoint
- [ ] Job posting by verified companies
- [ ] Job recommendations and alerts
- [ ] Candidate search for recruiters (filter by trust score, skills, location)
- [ ] Application tracker

### Phase 5: Monetization
- [ ] Pro tier for job seekers ($9/month) — unlimited ATS scoring, interview prep, resume tailoring
- [ ] Recruiter tier ($49-99/month) — search verified candidates, direct messaging
- [ ] Company business tier ($99-199/month) — unlimited job postings, analytics, ATS integrations
- [ ] B2B Verification API — $0.50/query for instant employment verification (replaces $30-100 background checks)
- [ ] Payment integration (Stripe)

### Phase 6: Data Products
- [ ] Salary intelligence (anonymous, from verified employees)
- [ ] Salary benchmarks by role, location, experience level, company size
- [ ] Education verification via institution partnerships

### Phase 7: Scale
- [ ] Mobile app (React Native)
- [ ] Auto-apply browser extension
- [ ] Visa-sponsored job filter (H1B/USCIS data)
- [ ] International expansion (country-specific verification)
- [ ] AI-powered career path recommendations
- [ ] Company reviews (verified employees only)
- [ ] ATS integrations (Greenhouse, Lever, Workday export)

## Competitive Positioning

| Feature | Existing Platforms | Stamp |
|---------|-------------------|-------|
| Profile data | Self-reported, no checks | Employer/university verified |
| Skill endorsements | Anyone endorses anyone | Manager/colleague only, at verified company |
| Trust signal | None | Trust score (0-100) based on verification % |
| Recruiter pricing | $800+/month | $49-99/month |
| Job seeker pricing | $30-60/month | Free (Pro at $9/month) |
| Salary data | Unverified, self-reported | Anonymous but from verified employees |
| Background checks | $30-100, takes 3-5 days | $0.50, instant API |
| Feed/content | Engagement bait, humble brags | No feed. Professional utility only. |

## The Moat

1. **Verification data compounds** — every verified claim is permanent value. Can't be replicated overnight.
2. **Network effect with trust** — professionals want to be where verified companies are, and vice versa.
3. **Cost structure** — near-zero marginal cost per user.
4. **B2B revenue potential** — verification API replaces the $4.5B background check industry.

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Cold start (no companies verifying) | Start with university verification for recent grads. Get 5-10 startups as founding verifiers. |
| Truework / The Work Number exist | They serve employers. Stamp serves the individual. Consumer-facing verified identity is unbuilt. |
| Companies won't verify for free | Start with startups (founder = HR). Make it 2 clicks. Offer verified employer badge as incentive. |
| LinkedIn could copy this | LinkedIn is incentivized NOT to verify (it would expose inflated profiles and hurt engagement). |

## Pitch Summary

**One-liner:** The verified professional identity platform. Employers confirm your claims, a badge appears.

**Problem:** Every professional profile on the internet is self-reported. Background checks cost $30-100 and take days.

**Solution:** You add your job or degree, the employer/university confirms it, a verified badge appears on your profile that you own.

**Business:** Free consumer profiles with verification. Revenue from recruiter seats, company tiers, and a B2B verification API.

**Market:** $4.5B background check industry + $15B recruiting tools market.

**Comparable exits:** Truework (~$480M acquisition by Checkr), Checkr ($5B valuation), Sterling ($2.8B acquisition).
