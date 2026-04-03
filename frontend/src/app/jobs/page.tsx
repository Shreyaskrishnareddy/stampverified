"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type GreenhouseJob = {
  title: string;
  company: string;
  company_logo?: string | null;
  company_domain?: string;
  location: string;
  location_type: string;
  employment_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  description_snippet?: string;
  apply_link?: string | null;
  posted_at?: string;
  source?: string;
  is_stamp_verified: boolean;
  score: number;
  matched_skills: string[];
  why_matched: string;
  seniority?: string;
};

type StampJob = {
  id: string;
  title: string;
  company: string;
  company_logo?: string | null;
  company_domain?: string;
  location: string;
  location_type: string;
  employment_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  posted_at?: string;
  is_stamp_verified: true;
  score: null;
  matched_skills: string[];
  why_matched: string;
};

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${sym}${fmt(min)}-${fmt(max)}`;
}

export default function JobMatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stampJobs, setStampJobs] = useState<StampJob[]>([]);
  const [greenhouseJobs, setGreenhouseJobs] = useState<GreenhouseJob[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Tabs + filters
  const [tab, setTab] = useState<"matches" | "saved" | "viewed">("matches");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [savedJobs, setSavedJobs] = useState<Set<number>>(new Set());
  const [viewedJobs, setViewedJobs] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
      setCheckingAuth(false);
    });
  }, [router, supabase.auth]);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError("");
    setStampJobs([]);
    setGreenhouseJobs([]);

    try {
      const result = await api.matchJobsFromResume(token, file);
      setStampJobs(result.jobs || []);
      setGreenhouseJobs(result.greenhouse_jobs || []);
      setTotalScanned(result.total_greenhouse_scanned || 0);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const toggleSaved = (idx: number) => {
    setSavedJobs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const markViewed = (idx: number) => {
    setViewedJobs(prev => new Set(prev).add(idx));
  };

  // Filter jobs based on tab + filters
  const filteredJobs = greenhouseJobs.filter((j, i) => {
    if (tab === "saved" && !savedJobs.has(i)) return false;
    if (tab === "viewed" && !viewedJobs.has(i)) return false;
    if (tab === "matches" && viewedJobs.has(i)) return false;
    if (remoteOnly && j.location_type !== "remote") return false;
    if (companySearch && !j.company.toLowerCase().includes(companySearch.toLowerCase())) return false;
    return true;
  });

  const matchCount = greenhouseJobs.filter((_, i) => !viewedJobs.has(i)).length;

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

  const hasResults = stampJobs.length > 0 || greenhouseJobs.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Upload area */}
        {!hasResults && !loading && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center hover:border-blue-300 hover:bg-blue-50/20 transition-all">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <label className="cursor-pointer">
              <span className="text-lg font-semibold text-gray-900">Drop your resume here</span>
              <p className="text-sm text-gray-400 mt-1">PDF — we never store your file</p>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
              <div className="mt-6 inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer">
                Upload Resume
              </div>
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-6 border border-red-100">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-10 h-10 mx-auto border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Searching 25,000+ jobs...</p>
            <p className="text-sm text-gray-400 mt-1">Matching against 350+ companies</p>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            {/* Upload different — small link */}
            <div className="flex justify-end mb-4">
              <label className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 transition-colors">
                New resume
                <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </div>

            {/* Stamp Verified Jobs */}
            {stampJobs.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                  <h3 className="text-sm font-bold text-gray-900">Jobs on Stamp</h3>
                </div>
                <div className="space-y-3">
                  {stampJobs.map((job, i) => (
                    <div key={`stamp-${i}`} className="bg-white rounded-2xl border border-amber-200/60 hover:border-amber-300 hover:shadow-md p-5 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {job.company_domain ? (
                            <img src={`https://www.google.com/s2/favicons?sz=128&domain=${job.company_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{job.company?.[0]}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                          <p className="text-xs text-gray-400 mt-1">{job.location}</p>
                        </div>
                        <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex-shrink-0">Apply</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {([
                { key: "matches" as const, label: `Matches (${matchCount})` },
                { key: "saved" as const, label: `Saved (${savedJobs.size})` },
                { key: "viewed" as const, label: `Viewed (${viewedJobs.size})` },
              ]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`text-xs font-medium px-4 py-2.5 border-b-2 -mb-px transition-all ${tab === t.key ? "text-gray-900 border-gray-900 font-semibold" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button onClick={() => setRemoteOnly(!remoteOnly)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${remoteOnly ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                Remote only
              </button>
            </div>

            {/* Company search */}
            <input type="text" value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Filter by company..." className="w-full text-sm px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4 placeholder:text-gray-300" />

            {/* Job cards — flat, OneProfile style */}
            {filteredJobs.length > 0 ? (
              <div className="space-y-3">
                {filteredJobs.map((job, idx) => {
                  const realIdx = greenhouseJobs.indexOf(job);
                  const scoreClass = job.score >= 70 ? "bg-green-50 text-green-700" : job.score >= 50 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500";
                  const isSaved = savedJobs.has(realIdx);

                  return (
                    <div key={`gh-${realIdx}`} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm p-5 transition-all relative">
                      {/* Bookmark — top right */}
                      <button onClick={() => toggleSaved(realIdx)} className={`absolute top-4 right-14 w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isSaved ? "text-blue-600" : "text-gray-300 hover:text-blue-500 hover:bg-blue-50"}`}>
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSaved ? 0 : 2}>
                          <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z"/>
                        </svg>
                      </button>

                      {/* Score — top right */}
                      <div className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${scoreClass}`}>
                        {job.score}
                      </div>

                      <div className="flex items-start gap-4 pr-24">
                        {/* Logo */}
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {job.company_domain ? (
                            <img src={`https://www.google.com/s2/favicons?sz=128&domain=${job.company_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">{job.company?.[0]}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-[15px] leading-snug">{job.title}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {job.company}
                            {job.location_type === "remote" && <span className="ml-2 text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Remote</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {job.location}
                            {job.salary_min && job.salary_max ? ` · ${formatSalary(job.salary_min, job.salary_max, job.salary_currency || "USD")}` : ""}
                          </p>

                          {/* Why matched + Apply on same row */}
                          <div className="flex items-end justify-between gap-4 mt-2">
                            {job.why_matched && (
                              <p className="text-[13px] text-gray-500 leading-relaxed">{job.why_matched}</p>
                            )}
                            {job.apply_link && (
                              <a
                                href={job.apply_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markViewed(realIdx)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex-shrink-0"
                              >
                                Apply
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {tab === "matches" ? "No matches found." : tab === "saved" ? "No saved jobs yet." : "No viewed jobs yet."}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="mt-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-8 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stand out when you apply</h3>
              <p className="text-sm text-gray-500 mb-6">Get your experience verified by past employers. Verified candidates get seen first.</p>
              <Link href={token ? "/dashboard?from=match" : "/?auth=signup&next=/dashboard?from=match"} className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                Verify your experience
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
