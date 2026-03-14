"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Suspense } from "react";

type Job = { id: string; title: string };
type Candidate = {
  full_name: string;
  username: string;
  headline: string;
  location: string;
  verified_employment: { company_name: string; title: string; is_current: boolean }[];
  verified_education: { institution: string; degree: string }[];
  verified_count: number;
};
type Application = {
  id: string;
  candidate_id: string;
  cover_note: string | null;
  status: string;
  applied_at: string;
  resume_signed_url: string | null;
  candidate: Candidate;
};
type Toast = { id: number; message: string; type: "success" | "error" };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function MatchingCandidatesTab({ token, jobId }: { token: string | null; jobId: string }) {
  const [matches, setMatches] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "applied" | "new">("all");

  useEffect(() => {
    if (!token || !jobId) return;
    setLoading(true);
    api.getJobMatches(token, jobId)
      .then(setMatches)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, jobId]);

  const filtered = filter === "all" ? matches
    : filter === "applied" ? matches.filter(m => m.applied)
    : matches.filter(m => !m.applied);

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {matches.length > 0 && (
        <div className="flex gap-2 mb-4">
          {(["all", "applied", "new"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:text-gray-700"}`}
            >
              {f === "all" ? `All (${matches.length})` : f === "applied" ? `Applied (${matches.filter(m => m.applied).length})` : `New (${matches.filter(m => !m.applied).length})`}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-600 font-medium mb-1">No matching candidates yet</p>
          <p className="text-sm text-gray-400">
            Candidates with matching experience who are open to work will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((candidate) => (
            <div key={candidate.user_id as string} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/${candidate.username}`} className="font-semibold text-gray-900 hover:text-gray-700 text-sm">
                      {candidate.full_name as string}
                    </Link>
                    {Boolean(candidate.applied) && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${candidate.application_status === "shortlisted" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}>
                        {String(candidate.application_status)}
                      </span>
                    )}
                    {!candidate.applied && (
                      <span className="text-[10px] font-medium text-gray-300">Hasn&apos;t applied</span>
                    )}
                  </div>
                  {typeof candidate.headline === "string" && <p className="text-xs text-gray-500">{candidate.headline}</p>}
                  <div className="mt-2 space-y-1">
                    {(candidate.verified_employment as { title: string; company_name: string; is_current: boolean }[])?.slice(0, 2).map((claim, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3 h-3 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {claim.title} at {claim.company_name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs text-gray-400">{candidate.verified_count as number} confirmed</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const jobIdParam = searchParams.get("job_id");

  const [token, setToken] = useState<string | null>(null);
  const [orgJobs, setOrgJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(jobIdParam || "");
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [tab, setTab] = useState<"applied" | "matching">("applied");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadJobs = useCallback(async (accessToken: string) => {
    try {
      const jobs = await api.getEmployerJobs(accessToken);
      const activeJobs = jobs.filter((j: Record<string, unknown>) => j.status === "active" || j.status === "paused");
      setOrgJobs(activeJobs.map((j: Record<string, unknown>) => ({ id: j.id as string, title: j.title as string })));

      if (!selectedJobId && activeJobs.length > 0) {
        setSelectedJobId(activeJobs[0].id as string);
      }
    } catch {
      router.push("/for-employers");
      return;
    }
    setLoading(false);
  }, [router, selectedJobId]);

  const loadApplications = useCallback(async (accessToken: string, jobId: string) => {
    if (!jobId) return;
    setLoadingApps(true);
    try {
      const data = await api.getEmployerApplications(accessToken, jobId);
      setApplications(data.applications || []);
      setJobTitle(data.job?.title || "");
    } catch { /* empty */ }
    setLoadingApps(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
      setToken(session.access_token);
      loadJobs(session.access_token);
    });
  }, [router, loadJobs, supabase.auth]);

  useEffect(() => {
    if (token && selectedJobId) {
      loadApplications(token, selectedJobId);
    }
  }, [token, selectedJobId, loadApplications]);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    if (!token) return;
    try {
      await api.updateApplicationStatus(token, appId, newStatus);
      addToast(newStatus === "shortlisted" ? "Candidate shortlisted" : "Application updated");
      loadApplications(token, selectedJobId);
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const appliedApps = applications.filter(a => a.status !== "rejected");
  const rejectedApps = applications.filter(a => a.status === "rejected");

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

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          </div>
          <Link href="/employer/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Dashboard
          </Link>
        </div>

        {/* Job selector */}
        {orgJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">No active jobs</p>
            <p className="text-sm text-gray-400">
              <Link href="/employer/jobs/new" className="text-gray-700 font-medium hover:text-gray-900">Post a job</Link> to start receiving applications.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <select
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium w-full sm:w-auto"
              >
                {orgJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
              <button
                onClick={() => setTab("applied")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "applied" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Applied ({appliedApps.length})
              </button>
              <button
                onClick={() => setTab("matching")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "matching" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Matching Candidates
              </button>
            </div>

            {/* Applied tab */}
            {tab === "applied" && (
              loadingApps ? (
                <div className="flex items-center justify-center pt-16">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                </div>
              ) : appliedApps.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <p className="text-gray-600 font-medium mb-1">No applications yet for {jobTitle}</p>
                  <p className="text-sm text-gray-400">Applications will appear here as candidates apply.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appliedApps.map(app => (
                    <div key={app.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/${app.candidate.username}`}
                              className="font-semibold text-gray-900 hover:text-gray-700"
                            >
                              {app.candidate.full_name}
                            </Link>
                            {app.status === "shortlisted" && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Shortlisted
                              </span>
                            )}
                          </div>
                          {app.candidate.headline && (
                            <p className="text-sm text-gray-500">{app.candidate.headline}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">Applied {timeAgo(app.applied_at)}</p>
                        </div>
                      </div>

                      {/* Verified claims — shown first and prominently */}
                      {app.candidate.verified_count > 0 && (
                        <div className="mb-4 space-y-1.5">
                          {app.candidate.verified_employment.map((claim, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3.5 h-3.5 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-gray-700">{claim.title} at {claim.company_name}</span>
                              {claim.is_current && <span className="text-[10px] text-gray-400">(current)</span>}
                            </div>
                          ))}
                          {app.candidate.verified_education.map((claim, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3.5 h-3.5 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-gray-700">{claim.degree}, {claim.institution}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cover note */}
                      {app.cover_note && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-600">
                          &ldquo;{app.cover_note}&rdquo;
                        </div>
                      )}

                      {/* Resume + actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {app.resume_signed_url && (
                            <a
                              href={app.resume_signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                              Resume
                            </a>
                          )}
                          <Link
                            href={`/${app.candidate.username}`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700"
                          >
                            View profile
                          </Link>
                        </div>

                        {app.status === "applied" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStatusChange(app.id, "shortlisted")}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                              Shortlist
                            </button>
                            <button
                              onClick={() => handleStatusChange(app.id, "rejected")}
                              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Rejected (collapsed) */}
                  {rejectedApps.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600">
                        {rejectedApps.length} rejected application{rejectedApps.length > 1 ? "s" : ""}
                      </summary>
                      <div className="mt-3 space-y-2">
                        {rejectedApps.map(app => (
                          <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4 opacity-60">
                            <p className="text-sm text-gray-500">{app.candidate.full_name}</p>
                            <p className="text-xs text-gray-400">{app.candidate.headline}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            )}

            {/* Matching candidates tab */}
            {tab === "matching" && (
              <MatchingCandidatesTab token={token} jobId={selectedJobId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function EmployerApplicationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    }>
      <ApplicationsContent />
    </Suspense>
  );
}
