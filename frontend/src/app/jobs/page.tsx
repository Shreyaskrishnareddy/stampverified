"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Suspense } from "react";

type Job = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  location_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  posted_at: string;
  org_name: string;
  org_domain: string;
  org_logo_url: string | null;
  job_function_name: string | null;
  job_function_category: string | null;
};

type InternetJob = {
  title: string;
  company: string;
  company_logo?: string | null;
  company_domain?: string;
  location: string;
  location_type: string;
  employment_type: string;
  description_snippet?: string;
  apply_link?: string | null;
  posted_at?: string;
  source?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  is_stamp_verified: boolean;
};

type ResumeSummary = {
  titles: string[];
  skills: string[];
  location: string | null;
};

type JobFunction = { id: string; name: string; slug: string; category: string };

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${sym}${fmt(min)}–${fmt(max)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

function formatEmploymentType(t: string) {
  return t.replace(/_/g, "-").replace(/\b\w/g, c => c.toUpperCase());
}

function formatLevel(l: string) {
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function JobsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "internet" ? "internet" : "stamp";

  const [tab, setTab] = useState<"stamp" | "internet">(initialTab);

  // Stamp jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent");
  const [functionFilter, setFunctionFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Internet jobs state
  const [internetJobs, setInternetJobs] = useState<InternetJob[]>([]);
  const [resumeSummary, setResumeSummary] = useState<ResumeSummary | null>(null);
  const [internetLoading, setInternetLoading] = useState(false);
  const [internetError, setInternetError] = useState("");

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      try {
        const [jobsData, funcsData] = await Promise.all([
          api.getPublicJobs({
            sort,
            ...(functionFilter && { function: functionFilter }),
            ...(locationFilter && { location_type: locationFilter }),
            ...(typeFilter && { employment_type: typeFilter }),
            ...(levelFilter && { experience_level: levelFilter }),
            ...(searchQuery && { q: searchQuery }),
          }),
          api.getJobFunctions(),
        ]);
        setJobs(jobsData);
        setFunctions(funcsData);
      } catch { /* empty */ }
      setLoading(false);
    };
    loadJobs();
  }, [sort, functionFilter, locationFilter, typeFilter, levelFilter, searchQuery]);

  const activeFilterCount = [functionFilter, locationFilter, typeFilter, levelFilter].filter(Boolean).length;

  const handleResumeUpload = async (file: File) => {
    setInternetLoading(true);
    setInternetError("");
    try {
      const result = await api.matchJobsFromResume(null, file);
      setInternetJobs(result.jobs || []);
      setResumeSummary(result.resume_summary || null);
    } catch (err: unknown) {
      setInternetError((err as Error).message);
    }
    setInternetLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setTab("stamp")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              tab === "stamp" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={tab === "stamp" ? "#C8A235" : "currentColor"} opacity={tab === "stamp" ? 1 : 0.4}><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
            Stamp Jobs
          </button>
          <button
            onClick={() => setTab("internet")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === "internet" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Internet Jobs
          </button>
        </div>

        {/* ─── STAMP JOBS TAB ─── */}
        {tab === "stamp" && (
          <>
            <p className="text-xs text-gray-400 mb-4">Real recruiters. Verified companies. Apply directly with your verified profile.</p>

            {/* Search + Sort + Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search jobs, companies..."
                  className="w-full px-4 py-2.5 pl-10 bg-white border border-gray-200 rounded-xl text-sm"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm">
                  <option value="recent">Recently Posted</option>
                  <option value="relevant">Most Relevant</option>
                </select>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors ${activeFilterCount > 0 ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
                >
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Function</label>
                    <select value={functionFilter} onChange={e => setFunctionFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                      <option value="">All</option>
                      {functions.map(f => <option key={f.slug} value={f.slug}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Work style</label>
                    <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                      <option value="">All</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                      <option value="">All</option>
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Level</label>
                    <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                      <option value="">All</option>
                      <option value="entry">Entry</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setFunctionFilter(""); setLocationFilter(""); setTypeFilter(""); setLevelFilter(""); }} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Stamp jobs list */}
            {loading ? (
              <div className="flex items-center justify-center pt-16">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <p className="text-gray-600 font-medium mb-1">No jobs yet</p>
                <p className="text-sm text-gray-400">
                  {activeFilterCount > 0 ? "Try adjusting your filters." : "Jobs appear here when verified companies post them."}
                </p>
                <button onClick={() => setTab("internet")} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
                  Try Internet Jobs instead
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {job.org_logo_url || job.org_domain ? (
                          <img src={job.org_logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${job.org_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <span className="text-sm font-bold text-gray-400">{job.org_name?.[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900">{job.title}</h3>
                          <svg viewBox="0 0 24 24" fill="#C8A235" className="w-4 h-4 flex-shrink-0"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{job.org_name}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {job.location || "No location"} &middot; {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"} &middot; {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {formatEmploymentType(job.employment_type)} &middot; {formatLevel(job.experience_level)}
                          {job.job_function_name ? ` · ${job.job_function_name}` : ""}
                          {job.posted_at ? ` · ${timeAgo(job.posted_at)}` : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── INTERNET JOBS TAB ─── */}
        {tab === "internet" && (
          <>
            <p className="text-xs text-gray-400 mb-6">Upload your resume to see matching jobs from across the web.</p>

            {/* Upload area (show when no results yet) */}
            {internetJobs.length === 0 && !internetLoading && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center hover:border-blue-300 hover:bg-blue-50/20 transition-all mb-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <label className="cursor-pointer">
                  <span className="text-base font-semibold text-gray-900">Upload your resume</span>
                  <p className="text-sm text-gray-400 mt-1">PDF only, max 5MB</p>
                  <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
                  <div className="mt-5 inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                    Upload Resume
                  </div>
                </label>
              </div>
            )}

            {/* Error */}
            {internetError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-6 border border-red-100">{internetError}</div>
            )}

            {/* Loading */}
            {internetLoading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-10 h-10 mx-auto border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Analyzing your resume...</p>
                <p className="text-sm text-gray-400 mt-1">Finding matching jobs across the web</p>
              </div>
            )}

            {/* Internet job results */}
            {internetJobs.length > 0 && (
              <>
                {/* Resume summary */}
                {resumeSummary && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {resumeSummary.titles.map((t, i) => (
                          <span key={i} className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">{t}</span>
                        ))}
                        {resumeSummary.skills.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{s}</span>
                        ))}
                      </div>
                      <label className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 flex-shrink-0 ml-3">
                        New resume
                        <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
                      </label>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-4">{internetJobs.length} matching jobs from across the web</p>

                <div className="space-y-3">
                  {internetJobs.map((job, i) => (
                    <div key={`${job.title}-${job.company}-${i}`} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {job.company_logo ? (
                            <img src={job.company_logo} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{job.company?.[0]}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {job.location} &middot; {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"}
                            {job.salary_min && job.salary_max ? ` · ${formatSalary(job.salary_min, job.salary_max, job.salary_currency || "USD")}` : ""}
                            &middot; {formatEmploymentType(job.employment_type)}
                            {job.source ? ` · via ${job.source}` : ""}
                          </p>
                          {job.description_snippet && (
                            <p className="text-xs text-gray-400 mt-2 line-clamp-2">{job.description_snippet}</p>
                          )}
                        </div>
                        {job.apply_link && (
                          <a href={job.apply_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex-shrink-0">
                            Apply
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-6 text-center">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Stand out from other applicants</p>
                  <p className="text-xs text-gray-500 mb-4">Get your experience verified to stand out when you apply.</p>
                  <Link href="/?auth=signup" className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                    Get Verified
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    }>
      <JobsContent />
    </Suspense>
  );
}
