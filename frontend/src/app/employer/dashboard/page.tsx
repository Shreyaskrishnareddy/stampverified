"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";

type Claim = Record<string, unknown>;
type Org = { name: string; domain: string; org_type: string; is_domain_verified: boolean };
type Member = { role: string; can_post_jobs: boolean; can_verify_claims: boolean };
type Toast = { id: number; message: string; type: "success" | "error" };

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function EmployerDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [member, setMember] = useState<Member | null>(null);
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
      const memberData = await api.getMyMembership(accessToken);
      setMember(memberData);
      setOrg({ name: memberData.org_name, domain: memberData.org_domain, org_type: "company", is_domain_verified: memberData.is_domain_verified || false });
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{org?.name}</h1>
                {org?.is_domain_verified && (
                  <svg className="w-5 h-5 text-[#C8A235]" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                )}
              </div>
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
              <div className="flex items-center gap-1">
                {member?.role === "admin" && (
                  <button
                    onClick={() => router.push("/employer/team")}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Team"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  </button>
                )}
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
        </div>

        {/* Domain verification banner */}
        {org && !org.is_domain_verified && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Verify your domain to unlock trusted actions</p>
                <p className="text-xs text-blue-700 mt-1">
                  Post Stamp Verified jobs, verify candidate claims, and contact candidates once your domain is verified.
                  You can still set up your workspace and prepare job drafts in the meantime.
                </p>
                <button onClick={() => router.push("/employer/settings")} className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors">
                  Go to Settings to verify →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Post a Job", href: "/employer/jobs/new", icon: "M12 4.5v15m7.5-7.5h-15", show: member?.can_post_jobs || member?.role === "admin" },
            { label: "Jobs", href: "/employer/jobs", icon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z", show: true },
            { label: "Applications", href: "/employer/applications", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z", show: true },
            { label: "Talent Search", href: "/employer/talent", icon: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z", show: true },
          ].filter(a => a.show).map(action => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={action.icon} /></svg>
              <p className="text-sm font-semibold text-gray-700">{action.label}</p>
            </button>
          ))}
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
                      {member?.can_verify_claims || member?.role === "admin" ? (
                        <>
                          <div className="flex gap-2">
                            <button onClick={() => handleVerify(claim.id as string, claimType)} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                              Verify
                            </button>
                            <button onClick={() => { setShowCorrect(claim.id as string); setCorrections({}); setShowDispute(null); }} className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                              Correct
                            </button>
                            <button onClick={() => { setShowDispute(claim.id as string); setDisputeReason(""); setShowCorrect(null); }} className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                              Dispute
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-2">
                            <strong>Verify</strong> = confirm as accurate.
                            <strong> Correct</strong> = suggest changes for review.
                            <strong> Dispute</strong> = flag as inaccurate.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">You need verify permissions to take action. Ask your workspace admin.</p>
                      )}
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
