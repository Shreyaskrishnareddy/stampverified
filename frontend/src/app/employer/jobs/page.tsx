"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Job = Record<string, unknown>;
type Toast = { id: number; message: string; type: "success" | "error" };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSalary(min: number, max: number, currency: string) {
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${currency === "USD" ? "$" : currency + " "}${fmt(min)}–${fmt(max)}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-gray-100 text-gray-500",
  paused: "bg-amber-50 text-amber-700",
  closed: "bg-gray-100 text-gray-400",
  filled: "bg-blue-50 text-blue-600",
};

export default function EmployerJobsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const membership = await api.getMyMembership(accessToken);
      setCanPost(membership.can_post_jobs || membership.role === "admin");
      const jobsList = await api.getEmployerJobs(accessToken);
      setJobs(jobsList);
    } catch {
      router.push("/for-employers");
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
      setToken(session.access_token);
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (!token) return;
    try {
      await api.updateJob(token, jobId, { status: newStatus });
      addToast(`Job ${newStatus}`);
      loadData(token);
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  const filteredJobs = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-sm text-gray-500 mt-1">{jobs.length} job{jobs.length !== 1 ? "s" : ""} posted</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/employer/dashboard")}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Dashboard
            </button>
            {canPost && (
              <Link
                href="/employer/jobs/new"
                className="bg-[#0A0A0A] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Post a Job
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { key: "all", label: `All (${jobs.length})` },
            { key: "active", label: `Active (${jobs.filter(j => j.status === "active").length})` },
            { key: "paused", label: "Paused" },
            { key: "closed", label: "Closed" },
            { key: "filled", label: "Filled" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Jobs list */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">
              {jobs.length === 0 ? "No jobs posted yet" : "No jobs match this filter"}
            </p>
            {jobs.length === 0 && canPost && (
              <p className="text-sm text-gray-400 mt-1">
                <Link href="/employer/jobs/new" className="text-gray-700 font-medium hover:text-gray-900">Post your first job</Link> to start attracting candidates.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => (
              <div key={job.id as string} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{job.title as string}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_STYLES[job.status as string] || "bg-gray-100 text-gray-500"}`}>
                        {job.status as string}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {job.location as string || "No location"} &middot; {(job.location_type as string || "onsite").replace("_", " ")} &middot; {(job.employment_type as string || "full_time").replace("_", "-")} &middot; {job.experience_level as string}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatSalary(job.salary_min as number, job.salary_max as number, job.salary_currency as string)}
                      {job.job_function_name ? ` · ${job.job_function_name as string}` : ""}
                    </p>
                    {typeof job.posted_at === "string" && (
                      <p className="text-xs text-gray-400 mt-1">Posted {formatDate(job.posted_at)}</p>
                    )}
                  </div>

                  {canPost && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {job.status === "active" && (
                        <>
                          <button onClick={() => handleStatusChange(job.id as string, "paused")} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50">
                            Pause
                          </button>
                          <button onClick={() => handleStatusChange(job.id as string, "filled")} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50">
                            Mark Filled
                          </button>
                          <button onClick={() => handleStatusChange(job.id as string, "closed")} className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">
                            Close
                          </button>
                        </>
                      )}
                      {job.status === "paused" && (
                        <button onClick={() => handleStatusChange(job.id as string, "active")} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50">
                          Resume
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
