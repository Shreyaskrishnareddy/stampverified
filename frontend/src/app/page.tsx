"use client";

import { createClient } from "@/lib/supabase";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useInView();
  return <div ref={ref} className={`${visible ? "animate-fade-up" : "opacity-0"} ${className}`}>{children}</div>;
}

const BlueTick = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#3B82F6">
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

const GoldTick = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#C8A235">
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

// ─── Auth Modal (unchanged) ────────────────────────────────────────────────

function AuthModal({ open, onClose, defaultMode = "signin" }: { open: boolean; onClose: () => void; defaultMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { if (open) { setMode(defaultMode); setError(""); setMessage(""); setEmail(""); setPassword(""); } }, [open, defaultMode]);

  if (!open) return null;

  const supabase = createClient();

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
        if (error) throw error;
        setMessage("Password reset link sent! Check your email.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: unknown) { setError((err as Error).message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === "forgot" ? "Reset password" : mode === "signup" ? "Create account" : "Welcome back"}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === "forgot" ? "We'll email you a reset link" : mode === "signup" ? "Start your verified profile" : "Sign in to Stamp"}
            </p>
          </div>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
        {message && <div className="bg-blue-50 text-blue-700 text-sm px-4 py-3 rounded-xl mb-4 border border-blue-100">{message}</div>}
        {mode !== "forgot" && (
          <>
            <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors mb-4 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs font-medium text-gray-400">or</span><div className="flex-1 h-px bg-gray-200" /></div>
          </>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
          {mode !== "forgot" && <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>}
          <button type="submit" disabled={loading} className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50">
            {loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 text-center space-y-2">
          {mode === "signin" && (<><button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="text-sm text-gray-400 hover:text-blue-600 transition-colors">Forgot password?</button><p className="text-sm text-gray-400">Don&apos;t have an account? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="font-semibold text-gray-700 hover:text-blue-600">Sign up</button></p></>)}
          {mode === "signup" && <p className="text-sm text-gray-400">Already have an account? <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="font-semibold text-gray-700 hover:text-blue-600">Sign in</button></p>}
          {mode === "forgot" && <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-sm font-semibold text-gray-700 hover:text-blue-600">Back to sign in</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────

function LandingContent() {
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [heroMode, setHeroMode] = useState<"candidate" | "employer">("candidate");

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "signin") { setAuthMode("signin"); setAuthOpen(true); }
    else if (auth === "signup") { setAuthMode("signup"); setAuthOpen(true); }
  }, [searchParams]);

  const openSignUp = () => { setAuthMode("signup"); setAuthOpen(true); };

  const heroContent = {
    candidate: {
      headline: <>Your career, verified.</>,
      subtext: "Add your job or degree. Your employer verifies it. A badge appears. Share your profile anywhere.",
      cta: "Get Verified",
      ctaAction: openSignUp,
    },
    employer: {
      headline: <>Hire from a pool where{" "}<br className="hidden sm:block" />every resume is real.</>,
      subtext: "Post jobs. Search candidates with verified backgrounds. No fake resumes. No background check needed.",
      cta: "Start Hiring",
      ctaAction: () => window.location.href = "/for-employers/register",
    },
  };

  const content = heroContent[heroMode];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />
      <Navbar />

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-14">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[900px] bg-gradient-to-b from-blue-50/50 via-blue-50/20 to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Toggle */}
          <div className="animate-fade-up inline-flex items-center bg-gray-100 rounded-full p-1 mb-10">
            <button
              onClick={() => setHeroMode("candidate")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${heroMode === "candidate" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              I&apos;m looking for work
            </button>
            <button
              onClick={() => setHeroMode("employer")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${heroMode === "employer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              I&apos;m hiring
            </button>
          </div>

          <h1 className="animate-fade-up delay-100 text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-gray-900">
            {content.headline}
          </h1>

          <p className="animate-fade-up delay-200 mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium">
            {content.subtext}
          </p>

          <div className="animate-fade-up delay-300 mt-10">
            <button onClick={content.ctaAction} className="group relative inline-flex items-center gap-3 bg-[#0A0A0A] text-white px-7 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all duration-300 shadow-2xl shadow-gray-900/25 hover:-translate-y-0.5">
              {content.cta}
              <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          </div>
          <p className="animate-fade-up delay-400 mt-5 text-sm text-gray-400 font-medium">Free for everyone. No credit card. No setup.</p>

          {/* Quick links */}
          <div className="animate-fade-up delay-500 mt-8 flex items-center justify-center gap-6">
            <Link href="/jobs" className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">Browse Jobs</Link>
            <Link href="/companies" className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">Browse Companies</Link>
          </div>

          {/* Hero demo card */}
          <div className="animate-fade-up delay-500 mt-16 relative max-w-xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-100/40 via-blue-50/30 to-blue-100/40 rounded-[2rem] blur-2xl opacity-60" />
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-gray-300/30 overflow-hidden border border-gray-100">
              {heroMode === "candidate" ? (
                /* Candidate mode: verified profile card */
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-600/30">S</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-gray-900">Sarah Martinez</h3>
                          <BlueTick className="w-5 h-5" />
                        </div>
                        <p className="text-sm text-gray-500">Product Lead at Notion</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">2 of 3</p>
                      <p className="text-[11px] text-gray-400">verified</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { title: "Product Lead", co: "Notion", date: "2022 — Present · 4y", verified: true },
                      { title: "Sr. Product Manager", co: "Stripe", date: "2019 — 2022 · 3y", verified: true },
                      { title: "MBA, Business", co: "Stanford GSB", date: "Class of 2019", verified: false },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all ${item.verified ? "bg-blue-50/40 border-blue-100" : "bg-gray-50/50 border-gray-100"}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.verified ? "bg-white text-blue-600 border border-blue-200 shadow-sm" : "bg-white text-gray-400 border border-gray-200"}`}>
                          {item.co.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.co} &middot; {item.date}</p>
                        </div>
                        {item.verified ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            <BlueTick className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Pending
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 font-mono">stampverified.com/sarah</p>
                  </div>
                </div>
              ) : (
                /* Employer mode: job posting card */
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-emerald-600/30">A</div>
                    <div>
                      <h3 className="font-bold text-gray-900">Senior Software Engineer</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-sm text-gray-500">Acme Corp</p>
                        <GoldTick className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">San Francisco · Hybrid</span>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">$180K – $220K</span>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">Full-time · Senior</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent applicants</p>
                    {[
                      { name: "Alex Chen", info: "3 verified claims", badge: "Shortlisted" },
                      { name: "Maria Kim", info: "2 verified claims", badge: "Applied" },
                    ].map((app, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{app.name.charAt(0)}</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{app.name}</p>
                            <p className="text-[11px] text-gray-400">{app.info}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${app.badge === "Shortlisted" ? "text-emerald-700 bg-emerald-100" : "text-gray-500 bg-gray-100"}`}>{app.badge}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">Posted by <span className="inline-flex items-center gap-0.5">Jane <GoldTick className="w-3 h-3" /></span></p>
                    <p className="text-[11px] text-gray-400">Every applicant is verified</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST BADGES ─── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-5xl mx-auto">
          <Section>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4 text-center">The trust difference</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight text-center">
              Verified candidates.{" "}<br className="hidden sm:block" />Verified companies. Real jobs.
            </h2>
          </Section>

          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { icon: <BlueTick className="w-8 h-8" />, title: "Verified Candidates", desc: "Every claim on a candidate's profile is verified by the source employer or university. Not self-reported." },
              { icon: <BlueTick className="w-8 h-8" />, title: "Verified Companies", desc: "Every company on Stamp is domain-verified with a real team behind it. No ghost companies, no scams." },
              { icon: <GoldTick className="w-8 h-8" />, title: "Verified Hiring Teams", desc: "Every recruiter is an approved member of a verified company. You always know who you're talking to." },
            ].map((item) => (
              <Section key={item.title}>
                <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-gray-300 transition-all h-full">
                  <div className="mb-5">{item.icon}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — CANDIDATES ─── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <Section>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">For Candidates</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">Get verified. Get found. Get hired.</h2>
          </Section>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Get verified", desc: "Add your work and education history. Your employer or university verifies it with one click." },
              { n: "2", title: "Browse real jobs", desc: "Every job on Stamp is from a real company with a real hiring team. No scams, no ghost postings." },
              { n: "3", title: "Apply with proof", desc: "Your verified profile replaces the resume cover letter cycle. Employers see the proof up front." },
            ].map(step => (
              <Section key={step.n}>
                <div className="bg-white rounded-2xl p-7 border border-gray-200 h-full">
                  <div className="w-10 h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center text-white text-sm font-extrabold mb-5">{step.n}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — EMPLOYERS ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Section>
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C8A235" }}>For Employers</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">Post jobs. Find talent. Skip the noise.</h2>
          </Section>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Register your company", desc: "Verify your domain. Invite your hiring team. Takes 2 minutes. Free to start." },
              { n: "2", title: "Post in 60 seconds", desc: "Paste from your careers page or ATS. We pull out the details. Review and publish." },
              { n: "3", title: "Hire with confidence", desc: "Every applicant has a verified background. Search talent directly. No background check needed." },
            ].map(step => (
              <Section key={step.n}>
                <div className="bg-white rounded-2xl p-7 border border-gray-200 h-full">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold mb-5" style={{ backgroundColor: "#C8A235" }}>{step.n}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="relative py-24 px-6 bg-[#0A0A0A] text-white overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/8 rounded-full blur-[150px]" />
        <div className="max-w-5xl mx-auto relative z-10">
          <Section>
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">The hiring problem is trust.</h2>
              <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">Resumes are self-reported. Background checks are slow and expensive. Both sides lose. Stamp fixes it.</p>
            </div>
          </Section>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {[
              { value: "78%", label: "of resumes contain misleading claims" },
              { value: "$100+", label: "per traditional background check" },
              { value: "Days", label: "wasted waiting for outdated checks" },
              { value: "$0", label: "Stamp is free for both sides" },
            ].map((stat, i) => (
              <Section key={i}>
                <div className={`p-8 h-full ${i < 3 ? "lg:border-r border-white/[.06]" : ""} text-center lg:text-left`}>
                  <p className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">{stat.value}</p>
                  <p className="mt-4 text-sm text-gray-400 leading-relaxed">{stat.label}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Section>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 text-center mb-12">Common questions</h2>
          </Section>
          <div className="space-y-3">
            {[
              { q: "Is Stamp free?", a: "Yes. Free for candidates. Free for companies. We'll introduce premium features for recruiters later, but the core platform is free." },
              { q: "How does verification work?", a: "You add a claim (job or degree). We send a secure link to the organization. They verify, correct, or dispute — no account needed. Takes one click." },
              { q: "What if my company isn't on Stamp?", a: "Add your claim anyway. It sits as pending until the company registers. You can send them an invite link or request the company be added." },
              { q: "Who can see my profile?", a: "Your public profile shows only verified claims. Resume visibility is controlled by you. 'Open to work' is never shown publicly — only employers see it in search." },
              { q: "What makes this different?", a: "Every other platform is self-reported. Stamp is source-verified. The employer or university that would know verifies each claim. That's the trust layer no one else has." },
            ].map((item, i) => (
              <Section key={i}>
                <details className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-colors">
                  <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-[15px] font-semibold text-gray-900 select-none list-none">
                    {item.q}
                    <svg className="w-5 h-5 text-gray-400 group-open:rotate-45 transition-transform duration-200 shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  </summary>
                  <div className="px-6 pb-5 text-[15px] text-gray-500 leading-relaxed -mt-1">{item.a}</div>
                </details>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-50 via-blue-50 to-blue-50 rounded-full blur-[100px] opacity-60" />
        </div>
        <Section>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">The hiring platform built on trust.</h2>
            <p className="mt-5 text-lg text-gray-500 font-medium">Verified candidates. Verified companies. Real jobs.</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={openSignUp} className="inline-flex items-center gap-3 bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all shadow-2xl shadow-gray-900/25 hover:-translate-y-0.5">
                Get Verified
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
              <Link href="/for-employers/register" className="inline-flex items-center gap-3 bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-50 transition-all">
                Start Hiring
              </Link>
            </div>
          </div>
        </Section>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight text-[#0A0A0A]">Stamp</span>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/jobs" className="hover:text-gray-600 transition-colors">Jobs</Link>
            <Link href="/companies" className="hover:text-gray-600 transition-colors">Companies</Link>
            <Link href="/for-employers" className="hover:text-gray-600 transition-colors">For Employers</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
