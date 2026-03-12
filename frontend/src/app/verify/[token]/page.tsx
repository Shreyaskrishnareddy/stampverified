"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

export default function VerifyPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [claim, setClaim] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState("");

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showCorrect, setShowCorrect] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthToken(session.access_token);
      } else {
        setNeedsAuth(true);
        setLoading(false);
      }
    });
  }, [supabase.auth]);

  // Load claim data once we have auth
  useEffect(() => {
    if (!authToken) return;
    api.getVerification(token, authToken)
      .then((data) => { setClaim(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [token, authToken]);

  const handleEmployerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setError(""); setSubmitting(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      setAuthToken(data.session!.access_token);
      setNeedsAuth(false);
      setLoading(true);
    } catch (err: unknown) { setError((err as Error).message); }
    setSubmitting(false);
  };

  const handleVerify = async () => {
    if (!authToken) return;
    setSubmitting(true);
    try { await api.verifyClaimByToken(token, authToken); setResult("verified"); setDone(true); }
    catch (err: unknown) { setError((err as Error).message); }
    setSubmitting(false);
  };

  const handleCorrect = async () => {
    if (!authToken) return;
    setSubmitting(true);
    try { await api.correctClaimByToken(token, authToken, corrections); setResult("corrected"); setDone(true); }
    catch (err: unknown) { setError((err as Error).message); }
    setSubmitting(false);
  };

  const handleDispute = async () => {
    if (!authToken || !disputeReason.trim()) return;
    setSubmitting(true);
    try { await api.disputeClaimByToken(token, authToken, disputeReason); setResult("disputed"); setDone(true); }
    catch (err: unknown) { setError((err as Error).message); }
    setSubmitting(false);
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  // Needs login
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-12">
        <div className="animate-fade-in bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-[#0A0A0A] px-8 py-6 text-center">
            <span className="text-white font-bold text-lg">Stamp</span>
            <p className="text-gray-400 text-sm mt-1">Sign in to verify a claim</p>
          </div>
          <div className="p-8">
            <p className="text-sm text-gray-500 mb-6">
              You need to sign in with your work email to verify this claim. If you don&apos;t have an account yet, register your organization first.
            </p>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
            <form onSubmit={handleEmployerLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work email</label>
                <input name="email" type="email" required placeholder="you@company.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <input name="password" type="password" required placeholder="Your password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50">
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-6">
              New to Stamp? <a href="/for-employers" className="font-semibold text-blue-600 hover:text-blue-700">Register your organization</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error && !claim) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Unable to load claim</h1>
          <p className="text-gray-500">{error}</p>
          <button onClick={() => router.push("/")} className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700">Go to Stamp</button>
        </div>
      </div>
    );
  }

  // Done
  if (done) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            result === "verified" || result === "corrected" ? "bg-emerald-50" : "bg-red-50"
          }`}>
            {result === "verified" || result === "corrected" ? (
              <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-3">
            {result === "verified" ? "Claim verified!" : result === "corrected" ? "Correction submitted!" : "Claim disputed"}
          </h1>
          <p className="text-gray-500 leading-relaxed">
            {result === "verified"
              ? "Thank you for confirming this claim. A verified badge now appears on their profile."
              : result === "corrected"
                ? "Your corrections have been sent to the user for review."
                : "Thank you for your response. The claim has been flagged and the user has been notified."}
          </p>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">Powered by <a href="/" className="font-semibold text-gray-600">stampverified.com</a></p>
          </div>
        </div>
      </div>
    );
  }

  if (!claim) return null;

  const isEmployment = claim.claim_type === "employment";

  // Verification form
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-12">
      <div className="animate-fade-in bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 w-full max-w-lg overflow-hidden">
        <div className="bg-[#0A0A0A] px-8 py-6 text-center">
          <span className="text-white font-bold text-lg">Stamp</span>
          <p className="text-gray-400 text-sm mt-1">Verification request</p>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <p className="text-sm text-gray-500 mb-4">
              <strong className="text-gray-900">{claim.claimer_name as string}</strong> claims the following:
            </p>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              {isEmployment ? (
                <div>
                  <p className="text-lg font-bold text-gray-900">{claim.title as string}</p>
                  <p className="text-gray-600 mt-0.5">{claim.company_name as string}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                    <span>
                      {claim.start_date as string}
                      {claim.is_current ? " — Present" : claim.end_date ? ` — ${claim.end_date as string}` : ""}
                    </span>
                    {claim.department ? (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{claim.department as string}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-bold text-gray-900">{claim.degree as string}</p>
                  <p className="text-gray-600 mt-0.5">{claim.institution as string}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                    {claim.field_of_study ? <span>{claim.field_of_study as string}</span> : null}
                    {claim.end_date || claim.start_date ? (
                      <>
                        {claim.field_of_study ? <span className="w-1 h-1 rounded-full bg-gray-300" /> : null}
                        <span>
                          {claim.start_date ? new Date(claim.start_date as string + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                          {claim.start_date && claim.end_date ? " — " : ""}
                          {claim.end_date ? new Date(claim.end_date as string + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}

          {!showDispute && !showCorrect ? (
            <div className="space-y-3">
              <button
                onClick={handleVerify}
                disabled={submitting}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitting ? "Verifying..." : "Yes, this is accurate"}
              </button>
              <button
                onClick={() => setShowCorrect(true)}
                className="w-full border border-blue-200 text-blue-700 py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Partially correct — I want to make corrections
              </button>
              <button
                onClick={() => setShowDispute(true)}
                className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                No, this is inaccurate
              </button>
            </div>
          ) : showCorrect ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-700">Submit corrections:</p>
              {isEmployment ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected title</label>
                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder={claim.title as string} value={corrections.corrected_title || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected start date</label>
                    <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={corrections.corrected_start_date || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected end date</label>
                    <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={corrections.corrected_end_date || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_end_date: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected degree</label>
                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder={claim.degree as string} value={corrections.corrected_degree || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_degree: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected field</label>
                    <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder={claim.field_of_study as string || ""} value={corrections.corrected_field || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_field: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected start date</label>
                    <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={corrections.corrected_start_date || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Corrected end date</label>
                    <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" value={corrections.corrected_end_date || ""} onChange={e => setCorrections(prev => ({ ...prev, corrected_end_date: e.target.value }))} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reason for correction</label>
                <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-20" placeholder="Explain the corrections..." value={corrections.correction_reason || ""} onChange={e => setCorrections(prev => ({ ...prev, correction_reason: e.target.value }))} />
              </div>
              <button onClick={handleCorrect} disabled={submitting} className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit corrections"}
              </button>
              <button onClick={() => { setShowCorrect(false); setCorrections({}); }} className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700">Cancel</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-1">What&apos;s inaccurate?</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please explain what's incorrect about this claim..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-28 placeholder:text-gray-400"
                required
              />
              <button onClick={handleDispute} disabled={submitting || !disputeReason.trim()} className="w-full bg-red-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit dispute"}
              </button>
              <button onClick={() => { setShowDispute(false); setDisputeReason(""); }} className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700">Cancel</button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-8">
            Powered by <strong>stampverified.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
