"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Job = Record<string, unknown>;

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
  return `${sym}${fmt(min)} – ${sym}${fmt(max)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatType(t: string) {
  return t.replace(/_/g, "-").replace(/\b\w/g, c => c.toUpperCase());
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auth + apply state
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    // Check auth first, then load job with or without auth token
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Load job (pass auth token if available, so verified candidates see POC name)
      try {
        const jobData = session
          ? await api.getPublicJobWithAuth(jobId, session.access_token)
          : await api.getPublicJob(jobId);
        setJob(jobData);
      } catch {
        setError("Job not found");
      }
      setLoading(false);

      if (session) {
        setIsLoggedIn(true);
        setToken(session.access_token);

        // Check if already applied
        try {
          const apps = await api.getMyApplications(session.access_token);
          const applied = (apps as { job_id: string }[]).some(a => a.job_id === jobId);
          setHasApplied(applied);
        } catch { /* empty */ }

        // Check if saved
        try {
          const savedJobs = await api.getSavedJobs(session.access_token);
          const isSaved = (savedJobs as { id: string }[]).some(j => j.id === jobId);
          setSaved(isSaved);
        } catch { /* empty */ }
      }
    });
  }, [jobId, supabase.auth]);

  const handleApply = async () => {
    if (!token) return;
    setApplying(true);
    setApplyError("");
    try {
      await api.applyToJob(token, { job_id: jobId, cover_note: coverNote || undefined });
      setApplySuccess(true);
      setHasApplied(true);
    } catch (err: unknown) {
      setApplyError((err as Error).message);
    }
    setApplying(false);
  };

  const handleSave = async () => {
    if (!token) return;
    try {
      if (saved) {
        await api.unsaveJob(token, jobId);
        setSaved(false);
      } else {
        await api.saveJob(token, jobId);
        setSaved(true);
      }
    } catch { /* empty */ }
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

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job not found</h1>
          <p className="text-gray-500 mb-6">This job may have been closed or removed.</p>
          <Link href="/jobs" className="text-sm font-medium text-gray-700 hover:text-gray-900">Browse all jobs</Link>
        </div>
      </div>
    );
  }

  const isClosed = job.status === "closed" || job.status === "filled";

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Back link */}
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          Back to Jobs
        </button>

        {/* Job header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {(job.org_logo_url || job.org_domain) ? (
                <img src={(job.org_logo_url as string) || `https://www.google.com/s2/favicons?sz=128&domain=${job.org_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-lg font-bold text-gray-400">{(job.org_name as string)?.[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{job.title as string}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <Link href={`/companies/${job.org_domain}`} className="text-gray-600 hover:text-gray-900 font-medium">{job.org_name as string}</Link>
                <svg viewBox="0 0 24 24" fill="#C8A235" className="w-4 h-4"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
              </div>
            </div>
            {/* Save button */}
            {isLoggedIn && (
              <button onClick={handleSave} className={`p-2 rounded-lg transition-colors ${saved ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`} title={saved ? "Saved" : "Save job"}>
                <svg className="w-5 h-5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
              </button>
            )}
          </div>

          {/* Job meta */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600">
              {job.location as string || "No location"} &middot; {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600">
              {formatSalary(job.salary_min as number, job.salary_max as number, job.salary_currency as string)}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600">
              {formatType(job.employment_type as string)} &middot; {(job.experience_level as string).charAt(0).toUpperCase() + (job.experience_level as string).slice(1)}
            </span>
          </div>

          {/* POC + posted */}
          {typeof job.poc_name === "string" && (
            <p className="text-sm text-gray-500 mb-4">Posted by {job.poc_name}{typeof job.posted_at === "string" ? ` · ${timeAgo(job.posted_at)}` : ""}</p>
          )}
          {!job.poc_name && typeof job.posted_at === "string" && (
            <p className="text-sm text-gray-500 mb-4">Posted by {job.org_name as string} · {timeAgo(job.posted_at)}</p>
          )}

          {/* Apply CTA */}
          {!isClosed ? (
            hasApplied ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
                You&apos;ve applied to this position. <Link href="/dashboard/applications" className="underline">View your applications</Link>
              </div>
            ) : isLoggedIn ? (
              <button
                onClick={() => setShowApplyModal(true)}
                className="w-full sm:w-auto bg-[#0A0A0A] text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Apply with Stamp
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/?auth=signup")}
                  className="w-full sm:w-auto bg-[#0A0A0A] text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Sign up to Apply
                </button>
                <p className="text-xs text-gray-400">You need a Stamp profile with at least 1 confirmed claim to apply.</p>
              </div>
            )
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
              This position is no longer accepting applications.
            </div>
          )}
        </div>

        {/* Job description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">About this role</h2>
          <div className="prose prose-sm prose-gray max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
            {job.description as string}
          </div>
        </div>

        {/* Company card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {(job.org_logo_url || job.org_domain) ? (
                <img src={(job.org_logo_url as string) || `https://www.google.com/s2/favicons?sz=128&domain=${job.org_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-lg font-bold text-gray-400">{(job.org_name as string)?.[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-gray-900">{job.org_name as string}</p>
                <svg viewBox="0 0 24 24" fill="#C8A235" className="w-4 h-4"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
              </div>
              <p className="text-sm text-gray-500">{job.org_domain as string}</p>
            </div>
            <Link href={`/companies/${job.org_domain}`} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">View all jobs</Link>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => !applying && setShowApplyModal(false)}>
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            {applySuccess ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Application submitted</h2>
                <p className="text-sm text-gray-500 mb-6">Your Stamp profile and resume have been sent to {job.org_name as string}.</p>
                <div className="space-y-2">
                  <Link href="/dashboard/applications" className="block w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 text-center">View my applications</Link>
                  <button onClick={() => setShowApplyModal(false)} className="block w-full text-sm text-gray-500 py-2">Close</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Apply to {job.title as string}</h2>
                <p className="text-sm text-gray-500 mb-6">at {job.org_name as string}</p>

                {applyError && (
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{applyError}</div>
                )}

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600">
                    Your Stamp profile, confirmed claims, and resume will be shared with the employer.
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Add a note (optional)</label>
                    <textarea
                      value={coverNote}
                      onChange={e => setCoverNote(e.target.value)}
                      maxLength={2000}
                      placeholder="Why are you interested in this role?"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-24"
                    />
                  </div>

                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {applying ? "Submitting..." : "Submit Application"}
                  </button>
                  <button onClick={() => setShowApplyModal(false)} className="w-full text-sm text-gray-500 py-2 hover:text-gray-700">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
