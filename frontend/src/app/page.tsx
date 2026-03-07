"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

const BlueTick = ({ className = "w-4.5 h-4.5" }: { className?: string }) => (
  <svg className={`${className} text-sky-500`} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

function HeroCard() {
  const cardRef = useRef<HTMLDivElement>(null);

  const isTouch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    if (isTouch) return;
    const card = cardRef.current;
    if (card) card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
  };

  return (
    <div className="animate-fade-up delay-500 mt-20 relative max-w-xl mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-r from-sky-200/40 via-sky-200/30 to-sky-200/40 rounded-[2rem] blur-2xl opacity-60" />
      <div className="gradient-border relative">
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative bg-white rounded-2xl shadow-2xl shadow-slate-300/30 overflow-hidden transition-transform duration-200 ease-out"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-sky-500/30">S</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-900">Sarah Martinez</h3>
                    <BlueTick className="w-5 h-5 animate-badge-pop delay-1000" />
                  </div>
                  <p className="text-sm text-slate-500">Product Lead at Notion</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-900">2 of 3</p>
                <p className="text-[11px] text-slate-400">verified</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { title: "Product Lead", co: "Notion", date: "2022 — Present", verified: true },
                { title: "Sr. Product Manager", co: "Stripe", date: "2019 — 2022", verified: true },
                { title: "MBA, Business", co: "Stanford GSB", date: "Class of 2019", verified: false },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all ${item.verified ? "bg-sky-50/40 border-sky-100" : "bg-slate-50/50 border-slate-100"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.verified ? "bg-white text-sky-600 border border-sky-200 shadow-sm" : "bg-white text-slate-400 border border-slate-200"}`}>
                    {item.co.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.co} &middot; {item.date}</p>
                  </div>
                  {item.verified ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                      <BlueTick className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Mini progress bar */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-400 font-mono">stampverified.com/sarah</p>
                <p className="text-[11px] font-semibold text-sky-600">67% verified</p>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="progress-bar h-full" style={{ width: "67%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setMessage("Password reset link sent! Check your email.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-8 h-8 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {mode === "forgot" ? "Reset password" : mode === "signup" ? "Create account" : "Welcome back"}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === "forgot" ? "We'll email you a reset link" : mode === "signup" ? "Start your verified profile" : "Sign in to Stamp"}
            </p>
          </div>
        </div>

        {error && <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 border border-rose-100">{error}</div>}
        {message && <div className="bg-sky-50 text-sky-700 text-sm px-4 py-3 rounded-xl mb-4 border border-sky-100">{message}</div>}

        {mode !== "forgot" && (
          <>
            <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors mb-4 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-300 transition-colors" />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-300 transition-colors" />
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-900/10">
            {loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode === "signin" && (
            <>
              <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="text-sm text-slate-400 hover:text-sky-600 transition-colors">Forgot password?</button>
              <p className="text-sm text-slate-400">Don&apos;t have an account? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="font-semibold text-slate-700 hover:text-sky-600 transition-colors">Sign up</button></p>
            </>
          )}
          {mode === "signup" && (
            <p className="text-sm text-slate-400">Already have an account? <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="font-semibold text-slate-700 hover:text-sky-600 transition-colors">Sign in</button></p>
          )}
          {mode === "forgot" && (
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-sm font-semibold text-slate-700 hover:text-sky-600 transition-colors">Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const openSignIn = () => { setAuthMode("signin"); setAuthOpen(true); };
  const openSignUp = () => { setAuthMode("signup"); setAuthOpen(true); };

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-7 h-7 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">Stamp</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={openSignIn} className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Sign in</button>
            <button onClick={openSignUp} className="text-[13px] font-semibold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-sm">Get started</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[900px] bg-gradient-to-b from-sky-100/50 via-sky-50/30 to-transparent rounded-full blur-[120px]" />
          <div className="absolute top-32 -left-20 w-[500px] h-[500px] bg-sky-100/30 rounded-full blur-[100px]" />
          <div className="absolute top-64 -right-20 w-[400px] h-[400px] bg-sky-100/20 rounded-full blur-[100px]" />
          <div className="dot-grid absolute inset-0 opacity-40" />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 bg-white border border-slate-200/80 rounded-full px-4 py-2 text-[13px] font-semibold text-slate-600 shadow-sm mb-10">
            <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sky-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" /></span>
            The verified career platform
          </div>

          <h1 className="animate-fade-up delay-100 text-[clamp(3rem,8vw,6rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            <span className="text-slate-900">Anyone can claim it.</span>
            <br />
            <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-sky-600 bg-clip-text text-transparent animate-gradient-x">
              Stamp verifies it.
            </span>
          </h1>

          <p className="animate-fade-up delay-200 mt-7 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            Add your job or degree. We send one email to the source.
            <br className="hidden sm:block" />
            They confirm it. A verified badge appears forever.
          </p>

          <div className="animate-fade-up delay-300 mt-10">
            <button onClick={openSignUp} className="group relative inline-flex items-center gap-3 bg-slate-900 text-white pl-7 pr-7 py-4 rounded-2xl text-[15px] font-semibold hover:bg-slate-800 transition-all duration-300 shadow-2xl shadow-slate-900/25 hover:shadow-slate-900/35 hover:-translate-y-0.5">
              Start for free
              <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          </div>
          <p className="animate-fade-up delay-400 mt-5 text-sm text-slate-400 font-medium">No credit card. No setup. Takes 30 seconds.</p>

          <HeroCard />
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-fade-in delay-1000">
          <div className="w-5 h-8 border-2 border-slate-300 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-slate-400 rounded-full animate-float" />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — Connected Steps ─── */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="max-w-5xl mx-auto relative">
          <Section>
            <p className="text-sm font-bold text-sky-600 uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">Three steps.<br />Zero guesswork.</h2>
          </Section>

          <div className="mt-20 grid md:grid-cols-3 gap-0">
            {[
              { n: "01", title: "Claim it", desc: "Add your job title, company, degree, or institution. Takes 30 seconds.", gradient: "from-sky-500 to-sky-600", iconBg: "bg-sky-50", iconColor: "text-sky-600", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /> },
              { n: "02", title: "We verify it", desc: "One email goes to your employer or university. They click a link. That's it.", gradient: "from-sky-500 to-sky-600", iconBg: "bg-sky-50", iconColor: "text-sky-600", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /> },
              { n: "03", title: "Badge appears", desc: "A permanent verified tick on your profile. Share it anywhere — it's yours.", gradient: "from-sky-400 to-sky-600", iconBg: "bg-sky-50", iconColor: "text-sky-600", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /> },
            ].map((step, i) => (
              <Section key={step.n} className={`delay-${(i + 1) * 100}`}>
                <div className={`group relative bg-white rounded-2xl p-8 border border-slate-200/80 hover:border-slate-300 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 h-full ${i < 2 ? "md:mr-3" : ""} ${i > 0 ? "md:ml-3" : ""}`}>
                  {/* Step number with gradient circle */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white text-sm font-extrabold shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                      {step.n}
                    </div>
                    {i < 2 && (
                      <div className="hidden md:flex flex-1 items-center">
                        <div className="flex-1 h-[2px] bg-gradient-to-r from-slate-200 to-slate-100" />
                        <svg className="w-3 h-3 text-slate-300 -ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.5L21 12l-7.5 7.5" /></svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-[15px] text-slate-500 leading-relaxed">{step.desc}</p>
                  {/* Bottom icon */}
                  <div className={`mt-6 w-10 h-10 rounded-xl ${step.iconBg} flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${step.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{step.icon}</svg>
                  </div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DARK STATS — Stripe-style ─── */}
      <section className="relative py-32 px-6 bg-slate-950 text-white overflow-hidden noise">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sky-500/8 rounded-full blur-[150px]" />

        <div className="max-w-5xl mx-auto relative z-10">
          <Section>
            <div className="text-center mb-20">
              <p className="text-sm font-bold text-sky-400 uppercase tracking-widest mb-4">Why this matters</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">Professional profiles<br />are fundamentally broken.</h2>
              <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">Self-reported claims. Zero accountability. Background checks that cost a fortune and take days. We built the fix.</p>
            </div>
          </Section>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {[
              { value: "78%", label: "of resumes contain misleading statements", src: "HireRight Report" },
              { value: "$100+", label: "average cost per background check", src: "Industry average" },
              { value: "3-5 days", label: "typical turnaround time", src: "SHRM Data" },
              { value: "2 clicks", label: "to verify on Stamp. Free.", src: "Our promise" },
            ].map((stat, i) => (
              <Section key={i} className={`delay-${(i + 1) * 100}`}>
                <div className={`p-8 h-full ${i < 3 ? "lg:border-r border-white/[.06]" : ""} ${i < 2 ? "sm:border-r border-white/[.06]" : ""} text-center lg:text-left`}>
                  <p className="text-5xl font-extrabold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent leading-tight animate-count-up">{stat.value}</p>
                  <p className="mt-4 text-sm text-slate-400 leading-relaxed">{stat.label}</p>
                  <p className="mt-3 text-[11px] text-slate-600 font-medium uppercase tracking-wider">{stat.src}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="py-32 px-6 bg-slate-50 relative">
        <div className="dot-grid absolute inset-0 opacity-20" />
        <div className="max-w-4xl mx-auto relative">
          <Section>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-sky-600 uppercase tracking-widest mb-4">Before & After</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">What changes with Stamp</h2>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-6">
            <Section>
              <div className="bg-white rounded-2xl border border-slate-200 p-8 h-full">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Without Stamp</h3>
                <ul className="space-y-3">
                  {["Anyone writes anything on their profile","No way to tell real from fake","Background checks cost $30-100 each","Results take 3-5 business days","Employers can't trust what they read"].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] text-slate-500">
                      <svg className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
            <Section className="delay-200">
              <div className="bg-white rounded-2xl border-2 border-sky-200 p-8 h-full relative overflow-hidden glow-blue">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-sky-400 to-sky-400" />
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <BlueTick className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">With Stamp</h3>
                <ul className="space-y-3">
                  {["Every claim confirmed by the actual source","Verified tick that can't be faked","Free for professionals, forever","Instant — one email, two clicks","A verified profile you can share anywhere"].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] text-slate-700">
                      <BlueTick className="w-4 h-4 mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-sky-50 via-sky-50 to-sky-50 rounded-full blur-[100px] opacity-60" />
        </div>
        <Section>
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mb-8 shadow-xl shadow-sky-200/40 animate-float-slow">
              <svg className="w-9 h-9 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">Ready to prove it?</h2>
            <p className="mt-5 text-lg text-slate-500 font-medium leading-relaxed">Build a verified profile that speaks louder than any resume.</p>
            <button onClick={openSignUp} className="mt-10 inline-flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-slate-800 transition-all duration-300 shadow-2xl shadow-slate-900/25 hover:shadow-slate-900/35 hover:-translate-y-0.5">
              Create your verified profile
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          </div>
        </Section>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg className="w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-extrabold text-slate-900">Stamp</span>
          </div>
          <p className="text-sm text-slate-400 font-medium">stampverified.com — your career, verified.</p>
        </div>
      </footer>
    </div>
  );
}
