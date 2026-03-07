"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function VerifyPage() {
  const params = useParams();
  const token = params.token as string;

  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState("");

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    api.getVerification(token)
      .then(setClaim)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleVerify = async () => {
    setSubmitting(true);
    try { await api.submitVerification(token, "verify"); setResult("verified"); setDone(true); }
    catch (err: any) { setError(err.message); }
    setSubmitting(false);
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    setSubmitting(true);
    try { await api.submitVerification(token, "dispute", disputeReason); setResult("disputed"); setDone(true); }
    catch (err: any) { setError(err.message); }
    setSubmitting(false);
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  // Error
  if (error && !claim) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.08a4.5 4.5 0 00-6.364-6.364L4.5 8.25a4.5 4.5 0 006.364 6.364" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Link not found</h1>
          <p className="text-slate-500">This verification link is invalid, expired, or has already been used.</p>
        </div>
      </div>
    );
  }

  // Done
  if (done) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${result === "verified" ? "bg-sky-50" : "bg-rose-50"}`}>
            {result === "verified" ? (
              <svg className="w-10 h-10 text-sky-600" viewBox="0 0 24 24" fill="none">
                <path d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-3">
            {result === "verified" ? "Claim verified!" : "Claim disputed"}
          </h1>
          <p className="text-slate-500 leading-relaxed">
            {result === "verified"
              ? "Thank you for confirming this claim. A verified badge now appears on their profile."
              : "Thank you for your response. The claim has been flagged and the user has been notified."}
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400">Powered by <a href="/" className="font-semibold text-slate-600">stampverified.com</a></p>
          </div>
        </div>
      </div>
    );
  }

  // Already reviewed
  if (claim.status === "verified" || claim.status === "disputed") {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${claim.status === "verified" ? "bg-sky-50" : "bg-rose-50"}`}>
            <svg className={`w-8 h-8 ${claim.status === "verified" ? "text-sky-600" : "text-rose-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Already reviewed</h1>
          <p className="text-slate-500">This claim has already been <strong>{claim.status}</strong>. No further action needed.</p>
        </div>
      </div>
    );
  }

  // Verification form
  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4 py-12">
      <div className="animate-fade-in bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            <span className="text-white font-bold">Stamp</span>
          </div>
          <p className="text-slate-400 text-sm">Verification request</p>
        </div>

        <div className="p-8">
          {/* Claim details */}
          <div className="mb-8">
            <p className="text-sm text-slate-500 mb-4">
              <strong className="text-slate-900">{claim.claimer_name}</strong> claims the following:
            </p>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              {claim.claim_type === "employment" ? (
                <div>
                  <p className="text-lg font-bold text-slate-900">{claim.title}</p>
                  <p className="text-slate-600 mt-0.5">{claim.company_name}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                    <span>
                      {claim.start_date}
                      {claim.is_current ? " — Present" : claim.end_date ? ` — ${claim.end_date}` : ""}
                    </span>
                    {claim.department && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{claim.department}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-bold text-slate-900">{claim.degree}</p>
                  <p className="text-slate-600 mt-0.5">{claim.institution}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                    {claim.field_of_study && <span>{claim.field_of_study}</span>}
                    {claim.year_completed && (
                      <>
                        {claim.field_of_study && <span className="w-1 h-1 rounded-full bg-slate-300" />}
                        <span>{claim.year_started ? `${claim.year_started} — ` : ""}{claim.year_completed}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 border border-rose-100">{error}</div>}

          {!showDispute ? (
            <div className="space-y-3">
              <button
                onClick={handleVerify}
                disabled={submitting}
                className="w-full bg-sky-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-sky-700 transition-all disabled:opacity-50 shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {submitting ? "Verifying..." : "Yes, this is accurate"}
              </button>
              <button
                onClick={() => setShowDispute(true)}
                className="w-full border border-slate-200 text-slate-600 py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                No, this is inaccurate
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 mb-1">What&apos;s inaccurate?</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please explain what's incorrect about this claim..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-rose-300 transition-colors resize-none h-28 placeholder:text-slate-400"
                required
              />
              <button
                onClick={handleDispute}
                disabled={submitting || !disputeReason.trim()}
                className="w-full bg-rose-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                {submitting ? "Submitting..." : "Submit dispute"}
              </button>
              <button
                onClick={() => { setShowDispute(false); setDisputeReason(""); }}
                className="w-full text-slate-500 py-2.5 text-sm font-medium hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center mt-8">
            This is a one-time request from <strong>stampverified.com</strong>. Your response is final.
          </p>
        </div>
      </div>
    </div>
  );
}
