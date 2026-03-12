"use client";

import { createClient } from "@/lib/supabase";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

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
  <svg className={`${className} text-blue-600`} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

function HeroCard() {
  return (
    <div className="animate-fade-up delay-500 mt-16 relative max-w-xl mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-100/40 via-blue-50/30 to-blue-100/40 rounded-[2rem] blur-2xl opacity-60" />
      <div className="relative bg-white rounded-2xl shadow-2xl shadow-gray-300/30 overflow-hidden border border-gray-100">
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
              { title: "Product Lead", co: "Notion", date: "2022 — Present", verified: true },
              { title: "Sr. Product Manager", co: "Stripe", date: "2019 — 2022", verified: true },
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-gray-400 font-mono">stampverified.com/sarah</p>
              <p className="text-[11px] font-semibold text-blue-600">67% verified</p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full" style={{ width: "67%" }} />
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
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    }
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
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400" />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400" />
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50">
            {loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode === "signin" && (
            <>
              <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} className="text-sm text-gray-400 hover:text-blue-600 transition-colors">Forgot password?</button>
              <p className="text-sm text-gray-400">Don&apos;t have an account? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="font-semibold text-gray-700 hover:text-blue-600 transition-colors">Sign up</button></p>
            </>
          )}
          {mode === "signup" && (
            <p className="text-sm text-gray-400">Already have an account? <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="font-semibold text-gray-700 hover:text-blue-600 transition-colors">Sign in</button></p>
          )}
          {mode === "forgot" && (
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LandingContent() {
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "signin") { setAuthMode("signin"); setAuthOpen(true); }
    else if (auth === "signup") { setAuthMode("signup"); setAuthOpen(true); }
  }, [searchParams]);

  const openSignUp = () => { setAuthMode("signup"); setAuthOpen(true); };

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
          <div className="animate-fade-up inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-[13px] font-semibold text-gray-600 shadow-sm mb-10">
            <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" /></span>
            The verified career platform
          </div>

          <h1 className="animate-fade-up delay-100 text-[clamp(3rem,8vw,5.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            <span className="text-gray-900">Anyone can claim it.</span>
            <br />
            <span className="text-blue-600">Stamp verifies it.</span>
          </h1>

          <p className="animate-fade-up delay-200 mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium">
            Add your job or degree. We send one email to the source.
            <br className="hidden sm:block" />
            They confirm it. A verified badge appears forever.
          </p>

          <div className="animate-fade-up delay-300 mt-10">
            <button onClick={openSignUp} className="group relative inline-flex items-center gap-3 bg-[#0A0A0A] text-white px-7 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all duration-300 shadow-2xl shadow-gray-900/25 hover:-translate-y-0.5">
              Start for free
              <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          </div>
          <p className="animate-fade-up delay-400 mt-5 text-sm text-gray-400 font-medium">No credit card. No setup. Takes 30 seconds.</p>

          <HeroCard />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-32 px-6 relative">
        <div className="max-w-5xl mx-auto relative">
          <Section>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">Three steps.<br />Zero guesswork.</h2>
          </Section>

          <div className="mt-20 grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Claim it", desc: "Add your job title, company, degree, or institution. Select from our database. Takes 30 seconds.", icon: "M12 4.5v15m7.5-7.5h-15" },
              { n: "02", title: "We verify it", desc: "Your employer or university gets a notification. They log in and confirm, correct, or dispute.", icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" },
              { n: "03", title: "Badge appears", desc: "A permanent verified badge on your profile. Share your link anywhere — it's yours.", icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" },
            ].map((step) => (
              <Section key={step.n}>
                <div className="group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full">
                  <div className="w-12 h-12 rounded-full bg-[#0A0A0A] flex items-center justify-center text-white text-sm font-extrabold mb-6 group-hover:scale-110 transition-transform">
                    {step.n}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed">{step.desc}</p>
                  <div className="mt-6 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={step.icon} /></svg>
                  </div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="relative py-32 px-6 bg-[#0A0A0A] text-white overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/8 rounded-full blur-[150px]" />
        <div className="max-w-5xl mx-auto relative z-10">
          <Section>
            <div className="text-center mb-20">
              <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Why this matters</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">Professional profiles<br />are fundamentally broken.</h2>
              <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">Self-reported claims. Zero accountability. Background checks that cost a fortune and take days. We built the fix.</p>
            </div>
          </Section>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {[
              { value: "78%", label: "of resumes contain misleading statements", src: "HireRight Report" },
              { value: "$100+", label: "average cost per background check", src: "Industry average" },
              { value: "3-5 days", label: "typical turnaround time", src: "SHRM Data" },
              { value: "2 clicks", label: "to verify on Stamp. Free.", src: "Our promise" },
            ].map((stat, i) => (
              <Section key={i}>
                <div className={`p-8 h-full ${i < 3 ? "lg:border-r border-white/[.06]" : ""} text-center lg:text-left`}>
                  <p className="text-5xl font-extrabold bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent leading-tight">{stat.value}</p>
                  <p className="mt-4 text-sm text-gray-400 leading-relaxed">{stat.label}</p>
                  <p className="mt-3 text-[11px] text-gray-600 font-medium uppercase tracking-wider">{stat.src}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOR EMPLOYERS ─── */}
      <section className="py-32 px-6 bg-gray-50 relative">
        <div className="max-w-5xl mx-auto">
          <Section>
            <div className="text-center mb-16">
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">For Employers</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Verify your team.<br />Build employer trust.</h2>
              <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">Register your organization on Stamp. Verify employee claims in seconds. Show candidates your company takes authenticity seriously.</p>
            </div>
          </Section>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Register your org", desc: "Sign up with your work email. Add your company details. Takes 2 minutes.", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
              { title: "Review claims", desc: "See pending verification requests from employees who listed your company. Verify, correct, or dispute.", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
              { title: "Build trust", desc: "Verified employees carry your company's stamp. Strengthen your employer brand.", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
            ].map((item) => (
              <Section key={item.title}>
                <div className="bg-white rounded-2xl p-8 border border-gray-200 h-full">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-50 via-blue-50 to-blue-50 rounded-full blur-[100px] opacity-60" />
        </div>
        <Section>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">Ready to prove it?</h2>
            <p className="mt-5 text-lg text-gray-500 font-medium leading-relaxed">Build a verified profile that speaks louder than any resume.</p>
            <button onClick={openSignUp} className="mt-10 inline-flex items-center gap-3 bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all duration-300 shadow-2xl shadow-gray-900/25 hover:-translate-y-0.5">
              Create your verified profile
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          </div>
        </Section>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight text-[#0A0A0A]">Stamp</span>
          <p className="text-sm text-gray-400 font-medium">stampverified.com — your career, verified.</p>
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
