"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sort, setSort] = useState(searchParams.get("sort") || "recent");
  const [functionFilter, setFunctionFilter] = useState(searchParams.get("function") || "");
  const [locationFilter, setLocationFilter] = useState(searchParams.get("location_type") || "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("employment_type") || "");
  const [levelFilter, setLevelFilter] = useState(searchParams.get("experience_level") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">Every role is from a real company. Every company is on Stamp.</p>
        </div>

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
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
            >
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
                  {functions.map(f => (
                    <option key={f.slug} value={f.slug}>{f.name}</option>
                  ))}
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
              <button
                onClick={() => { setFunctionFilter(""); setLocationFilter(""); setTypeFilter(""); setLevelFilter(""); }}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Jobs list */}
        {loading ? (
          <div className="flex items-center justify-center pt-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">No jobs found</p>
            <p className="text-sm text-gray-400">
              {activeFilterCount > 0 ? "Try adjusting your filters." : "Check back soon — new jobs are posted daily."}
            </p>
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
                  {/* Company logo */}
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {job.org_logo_url || job.org_domain ? (
                      <img
                        src={job.org_logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${job.org_domain}`}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{job.org_name?.[0]}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {job.org_name}
                      <span className="inline-block w-3 h-3 ml-1 align-[-2px]">
                        <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3 h-3"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                    </p>
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
