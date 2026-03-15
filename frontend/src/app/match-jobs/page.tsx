"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Job = {
  id?: string;
  title: string;
  company: string;
  company_logo?: string | null;
  company_domain?: string;
  location: string;
  location_type: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  description_snippet?: string;
  apply_link?: string | null;
  posted_at?: string;
  source?: string;
  is_stamp_verified: boolean;
};

type ResumeSummary = {
  titles: string[];
  skills: string[];
  location: string | null;
  experience_years: number | null;
  companies: string[];
};

function formatType(t: string) {
  return t.replace(/_/g, "-").replace(/\b\w/g, c => c.toUpperCase());
}

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${sym}${fmt(min)}–${fmt(max)}`;
}

export default function JobMatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<ResumeSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stampCount, setStampCount] = useState(0);
  const [externalCount, setExternalCount] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
      }
      setCheckingAuth(false);
    });
  }, [router, supabase.auth]);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError("");
    setJobs([]);
    setSummary(null);

    try {
      const result = await api.matchJobsFromResume(token, file);
      setJobs(result.jobs || []);
      setSummary(result.resume_summary || null);
      setSearchQuery(result.search_query || "");
      setStampCount(result.stamp_jobs_count || 0);
      setExternalCount(result.external_jobs_count || 0);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  if (checkingAuth) {
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
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Find Jobs That Match You</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your resume. See matching jobs in seconds.</p>
        </div>

        {/* Upload area */}
        {jobs.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center hover:border-blue-300 hover:bg-blue-50/20 transition-all">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <label className="cursor-pointer">
              <span className="text-lg font-semibold text-gray-900">Drop your resume here</span>
              <p className="text-sm text-gray-400 mt-1">PDF only, max 5MB</p>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <div className="mt-6 inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                Upload Resume
              </div>
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-6 border border-red-100">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-10 h-10 mx-auto border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Analyzing your resume...</p>
            <p className="text-sm text-gray-400 mt-1">Finding matching jobs across the web</p>
          </div>
        )}

        {/* Results */}
        {jobs.length > 0 && (
          <>
            {/* Resume summary */}
            {summary && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">What I found in your resume</h3>
                <div className="flex flex-wrap gap-2">
                  {summary.titles.map((t, i) => (
                    <span key={i} className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">{t}</span>
                  ))}
                  {summary.skills.slice(0, 6).map((s, i) => (
                    <span key={i} className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{s}</span>
                  ))}
                  {summary.location && (
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{summary.location}</span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <label className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 transition-colors">
                    Try a different resume
                    <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                  </label>
                </div>
              </div>
            )}

            {(() => {
              const stampJobs = jobs.filter(j => j.is_stamp_verified);
              const externalJobs = jobs.filter(j => !j.is_stamp_verified);

              const renderJobCard = (job: Job, i: number) => (
                <div
                  key={`${job.title}-${job.company}-${i}`}
                  className={`bg-white rounded-2xl border p-5 transition-all ${
                    job.is_stamp_verified
                      ? "border-amber-200/60 hover:border-amber-300 hover:shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {job.company_logo ? (
                        <img src={job.company_logo} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : job.company_domain ? (
                        <img src={`https://www.google.com/s2/favicons?sz=128&domain=${job.company_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">{job.company?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                        {job.is_stamp_verified && (
                          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {job.location} &middot; {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"}
                        {job.salary_min && job.salary_max ? ` · ${formatSalary(job.salary_min, job.salary_max, job.salary_currency || "USD")}` : ""}
                        &middot; {formatType(job.employment_type)}
                        {job.source ? ` · via ${job.source}` : ""}
                      </p>
                      {job.description_snippet && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{job.description_snippet}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {job.is_stamp_verified ? (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-gray-800 rounded-xl transition-colors"
                        >
                          Apply with Stamp
                        </Link>
                      ) : job.apply_link ? (
                        <a
                          href={job.apply_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                          Apply
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );

              return (
                <>
                  {/* Section 1: Stamp Verified Jobs */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                      <h3 className="text-sm font-bold text-gray-900">Jobs on Stamp</h3>
                    </div>
                    {stampJobs.length > 0 ? (
                      <>
                        <p className="text-xs text-gray-400 mb-4">Real recruiters. Verified company. Apply directly with your verified profile.</p>
                        <div className="space-y-3">
                          {stampJobs.map((job, i) => renderJobCard(job, i))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-amber-200/60 bg-amber-50/30 p-6 text-center">
                        <p className="text-sm font-medium text-gray-700">Verified jobs are coming soon</p>
                        <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto">
                          When verified companies post on Stamp, their jobs appear here first. No fake postings. No ghost listings. Just real roles from real teams.
                        </p>
                        <Link href="/for-employers" className="inline-block mt-4 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors">
                          Are you hiring? Post on Stamp →
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Section 2: External Jobs */}
                  {externalJobs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-500 mb-1">
                        {stampJobs.length > 0 ? "More Matching Jobs" : "Matching Jobs"}
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">Relevant jobs from across the web.</p>
                      <div className="space-y-3">
                        {externalJobs.map((job, i) => renderJobCard(job, i))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* CTA */}
            <div className="mt-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-8 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stand out from other applicants</h3>
              <p className="text-sm text-gray-500 mb-6">
                Add your experience and get your first claim verified to stand out when you apply.
              </p>
              <Link
                href={token ? "/dashboard?from=match" : "/?auth=signup&next=/dashboard?from=match"}
                className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Verified
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
