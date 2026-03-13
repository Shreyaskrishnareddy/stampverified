"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";

type Claim = Record<string, unknown>;
type Org = { name: string; domain: string; org_type: string };
type Toast = { id: number; message: string; type: "success" | "error" };

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function EmployerDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [employees, setEmployees] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "verified">("pending");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [showCorrect, setShowCorrect] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [disputeReason, setDisputeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showDepart, setShowDepart] = useState<string | null>(null);
  const [departDate, setDepartDate] = useState("");

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const orgData = await api.getMyOrganization(accessToken);
      setOrg(orgData);
    } catch {
      router.push("/for-employers");
      return;
    }
    try { setClaims(await api.getEmployerClaims(accessToken)); } catch { /* empty */ }
    try { setEmployees(await api.getEmployerEmployees(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
      setToken(session.access_token);
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const handleVerify = async (claimId: string, claimType: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await api.employerVerifyClaim(token, claimId, claimType);
      loadData(token);
      addToast("Claim verified!");
    } catch { addToast("Failed to verify", "error"); }
    setSubmitting(false);
  };

  const handleCorrect = async (claimId: string, claimType: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await api.employerCorrectClaim(token, claimId, claimType, corrections);
      setShowCorrect(null); setCorrections({});
      loadData(token);
      addToast("Correction submitted!");
    } catch { addToast("Failed to submit correction", "error"); }
    setSubmitting(false);
  };

  const handleDispute = async (claimId: string, claimType: string) => {
    if (!token || !disputeReason.trim()) return;
    setSubmitting(true);
    try {
      await api.employerDisputeClaim(token, claimId, claimType, disputeReason);
      setShowDispute(null); setDisputeReason("");
      loadData(token);
      addToast("Claim disputed.");
    } catch { addToast("Failed to dispute", "error"); }
    setSubmitting(false);
  };

  const handleDepart = async (claimId: string) => {
    if (!token || !departDate) return;
    setSubmitting(true);
    try {
      await api.employerMarkDeparted(token, claimId, departDate);
      setShowDepart(null); setDepartDate("");
      loadData(token);
      addToast("Employee marked as departed.");
    } catch { addToast("Failed to update", "error"); }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${t.type === "success" ? "bg-white border-emerald-200" : "bg-white border-red-200"}`}>
            {t.message}
          </div>
        ))}
      </div>

      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{org?.name}</h1>
              <p className="text-sm text-gray-500">{org?.domain} &middot; {org?.org_type}</p>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-4 sm:gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{claims.length}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Pending</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{employees.length}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Verified</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/employer/settings")}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <button onClick={() => setTab("pending")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "pending" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Pending ({claims.length})
          </button>
          <button onClick={() => setTab("verified")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "verified" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Verified ({employees.length})
          </button>
        </div>

        {/* Pending claims */}
        {tab === "pending" && (
          <div className="space-y-4">
            {claims.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                </div>
                <p className="text-gray-600 font-medium mb-1">No pending verification requests</p>
                <p className="text-sm text-gray-400">When employees add claims listing {org?.name}, they&apos;ll appear here for your review.</p>
              </div>
            ) : claims.map(claim => {
              const claimType = claim.claim_type as string || "employment";
              const isEmp = claimType === "employment";
              return (
                <div key={claim.id as string} className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-gray-900">{claim.claimer_name as string || "Unknown user"}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isEmp ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-500"}`}>
                          {isEmp ? "Employment" : "Education"}
                        </span>
                        <StatusBadge status={claim.status as string} />
                      </div>
                      {isEmp ? (
                        <div>
                          <p className="text-sm text-gray-600">{claim.title as string}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {claim.start_date ? formatDate(claim.start_date as string) : ""}
                            {claim.is_current ? " — Present" : claim.end_date ? ` — ${formatDate(claim.end_date as string)}` : ""}
                            {claim.department ? ` · ${claim.department as string}` : ""}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600">{claim.degree as string}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {claim.field_of_study ? `${claim.field_of_study as string} · ` : ""}
                            {claim.end_date ? new Date(claim.end_date as string + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {showCorrect === claim.id ? (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                      <p className="text-sm font-semibold text-blue-900">Submit corrections:</p>
                      {isEmp ? (
                        <>
                          <input placeholder="Corrected title" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" value={corrections.corrected_title || ""} onChange={e => setCorrections(p => ({ ...p, corrected_title: e.target.value }))} />
                          <input type="date" placeholder="Corrected start" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" value={corrections.corrected_start_date || ""} onChange={e => setCorrections(p => ({ ...p, corrected_start_date: e.target.value }))} />
                          <input type="date" placeholder="Corrected end" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" value={corrections.corrected_end_date || ""} onChange={e => setCorrections(p => ({ ...p, corrected_end_date: e.target.value }))} />
                        </>
                      ) : (
                        <>
                          <input placeholder="Corrected degree" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" value={corrections.corrected_degree || ""} onChange={e => setCorrections(p => ({ ...p, corrected_degree: e.target.value }))} />
                          <input placeholder="Corrected field" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" value={corrections.corrected_field || ""} onChange={e => setCorrections(p => ({ ...p, corrected_field: e.target.value }))} />
                        </>
                      )}
                      <textarea placeholder="Reason" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white resize-none h-16" value={corrections.correction_reason || ""} onChange={e => setCorrections(p => ({ ...p, correction_reason: e.target.value }))} />
                      <div className="flex gap-2">
                        <button onClick={() => handleCorrect(claim.id as string, claimType)} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">Submit</button>
                        <button onClick={() => { setShowCorrect(null); setCorrections({}); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : showDispute === claim.id ? (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 space-y-3">
                      <p className="text-sm font-semibold text-red-900">Why is this claim inaccurate?</p>
                      <textarea className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white resize-none h-20" value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="Explain..." />
                      <div className="flex gap-2">
                        <button onClick={() => handleDispute(claim.id as string, claimType)} disabled={submitting || !disputeReason.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Dispute</button>
                        <button onClick={() => { setShowDispute(null); setDisputeReason(""); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <button onClick={() => handleVerify(claim.id as string, claimType)} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                          Verify
                        </button>
                        <button onClick={() => setShowCorrect(claim.id as string)} className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                          Correct
                        </button>
                        <button onClick={() => setShowDispute(claim.id as string)} className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          Dispute
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        <strong>Verify</strong> = confirm as accurate (badge appears on their profile).
                        <strong> Correct</strong> = suggest changes for review.
                        <strong> Dispute</strong> = flag as inaccurate (hidden from their profile).
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Verified employees */}
        {tab === "verified" && (
          <div className="space-y-4">
            {employees.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
                </div>
                <p className="text-gray-600 font-medium mb-1">No verified claims yet</p>
                <p className="text-sm text-gray-400">Once you verify a claim in the Pending tab, it will appear here.</p>
              </div>
            ) : employees.map(emp => (
              <div key={emp.id as string} className="bg-white rounded-2xl border border-emerald-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{emp.claimer_name as string || "Employee"}</p>
                    <p className="text-sm text-gray-600 truncate">{emp.title as string}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {emp.start_date ? formatDate(emp.start_date as string) : ""}
                      {emp.is_current ? " — Present" : emp.end_date ? ` — ${formatDate(emp.end_date as string)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status="verified" />
                    {Boolean(emp.is_current) && (
                      showDepart === emp.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="date" className="px-2 py-1 border border-gray-200 rounded-lg text-sm" value={departDate} onChange={e => setDepartDate(e.target.value)} />
                          <button onClick={() => handleDepart(emp.id as string)} disabled={submitting || !departDate} className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded-lg disabled:opacity-50">Save</button>
                          <button onClick={() => setShowDepart(null)} className="text-xs text-gray-500">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowDepart(emp.id as string)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                          Mark departed
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
