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

type ResumeSummary = {
  titles: string[];
  skills: string[];
  location: string | null;
  experience_years: number | null;
  companies: string[];
};

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${sym}${fmt(min)}-${fmt(max)}`;
}

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function JobMatchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [error, setError] = useState("");
  const [stampJobs, setStampJobs] = useState<StampJob[]>([]);
  const [greenhouseJobs, setGreenhouseJobs] = useState<GreenhouseJob[]>([]);
  const [summary, setSummary] = useState<ResumeSummary | null>(null);
  const [totalScanned, setTotalScanned] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Skill selection
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());
  const [newSkill, setNewSkill] = useState("");

  // Level selection
  const [selectedLevel, setSelectedLevel] = useState("mid");

  // Filter
  const [filter, setFilter] = useState<"best" | "all" | "remote">("best");

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
    setSummary(null);

    try {
      const result = await api.matchJobsFromResume(token, file);
      setSummary(result.resume_summary || null);
      setStampJobs(result.jobs || []);
      setGreenhouseJobs(result.greenhouse_jobs || []);
      setTotalScanned(result.total_greenhouse_scanned || 0);

      // Initialize skills
      const skills = result.resume_summary?.skills || [];
      setActiveSkills(new Set(skills));

      // Infer level
      const titles = (result.resume_summary?.titles || []).join(" ").toLowerCase();
      if (titles.includes("senior") || titles.includes("lead") || titles.includes("staff")) {
        setSelectedLevel("senior");
      } else if (titles.includes("junior") || titles.includes("intern") || titles.includes("entry")) {
        setSelectedLevel("junior");
      } else {
        setSelectedLevel("mid");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handleRematch = async () => {
    setRematchLoading(true);
    try {
      const result = await api.matchJobsWithSkills(
        Array.from(activeSkills),
        selectedLevel,
      );
      setGreenhouseJobs(result.greenhouse_jobs || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setRematchLoading(false);
  };

  const toggleSkill = (skill: string) => {
    setActiveSkills(prev => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const addSkill = () => {
    const s = newSkill.trim().toLowerCase();
    if (s) {
      setActiveSkills(prev => new Set(prev).add(s));
      setNewSkill("");
    }
  };

  const filteredGreenhouse = greenhouseJobs.filter(j => {
    if (filter === "best") return j.score >= 60;
    if (filter === "remote") return j.location_type === "remote" && j.score >= 60;
    return true;
  });

  const bestCount = greenhouseJobs.filter(j => j.score >= 60).length;
  const remoteCount = greenhouseJobs.filter(j => j.location_type === "remote" && j.score >= 60).length;

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Find Jobs That Match You</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your resume. See matching jobs from top companies.</p>
        </div>

        {/* Upload area */}
        {!hasResults && !loading && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center hover:border-blue-300 hover:bg-blue-50/20 transition-all">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <label className="cursor-pointer">
              <span className="text-lg font-semibold text-gray-900">Upload your resume</span>
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
            <p className="text-gray-600 font-medium">Matching your resume...</p>
            <p className="text-sm text-gray-400 mt-1">Scanning 7,600+ jobs from 48 top companies</p>
            <div className="mt-4 text-xs text-gray-300 space-y-1">
              <p>Airbnb, Stripe, OpenAI, Databricks, Discord, Vercel, MongoDB...</p>
              <p>This takes about 10-15 seconds</p>
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            {/* Resume summary + skill editing */}
            {summary && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Your Profile</h3>
                  <label className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 transition-colors">
                    Upload different
                    <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                  </label>
                </div>

                {/* Titles */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {summary.titles.filter(t => t.length < 40).slice(0, 3).map((t, i) => (
                    <span key={i} className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">{t}</span>
                  ))}
                  {summary.location && (
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">{summary.location}</span>
                  )}
                </div>

                {/* Skills — toggleable */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-2">Click to toggle skills. Add skills the parser missed.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.skills.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => toggleSkill(s)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-all ${
                          activeSkills.has(s)
                            ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
                            : "text-gray-300 bg-white border border-gray-200 line-through"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    {/* Show added skills not in original list */}
                    {Array.from(activeSkills).filter(s => !summary.skills.includes(s)).map((s, i) => (
                      <button
                        key={`added-${i}`}
                        onClick={() => toggleSkill(s)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addSkill(); }}
                      placeholder="Add skill..."
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-36"
                    />
                    <button onClick={addSkill} className="text-xs font-medium px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">+</button>
                  </div>
                </div>

                {/* Level selection */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-400">Level:</span>
                  {(["junior", "mid", "senior"] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                        selectedLevel === level
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {level === "junior" ? "Early career" : level === "mid" ? "Mid" : "Senior"}
                    </button>
                  ))}
                </div>

                {/* Rematch button */}
                <button
                  onClick={handleRematch}
                  disabled={rematchLoading}
                  className="text-xs font-semibold px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {rematchLoading ? "Matching..." : "Update matches"}
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="text-xs text-gray-400 mb-4">
              {bestCount} matched · {remoteCount} remote
            </div>

            {/* Section 1: Stamp Verified Jobs */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#C8A235"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                <h3 className="text-sm font-bold text-gray-900">Jobs on Stamp</h3>
              </div>
              {stampJobs.length > 0 ? (
                <>
                  <p className="text-xs text-gray-400 mb-4">Verified employers. Apply with your verified profile.</p>
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
                            <p className="text-xs text-gray-400 mt-1">
                              {job.location} · {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"}
                              {job.salary_min && job.salary_max ? ` · ${formatSalary(job.salary_min, job.salary_max, job.salary_currency || "USD")}` : ""}
                            </p>
                          </div>
                          <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-gray-800 rounded-xl transition-colors flex-shrink-0">
                            Apply
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-200/60 bg-amber-50/30 p-6 text-center">
                  <p className="text-sm font-medium text-gray-700">Verified jobs coming soon</p>
                  <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto">When verified companies post on Stamp, their jobs appear here first.</p>
                  <Link href="/for-employers" className="inline-block mt-4 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors">
                    Are you hiring? Post on Stamp &rarr;
                  </Link>
                </div>
              )}
            </div>

            {/* Section 2: Greenhouse Jobs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Matching Jobs from Top Companies</h3>
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-4">
                {(["best", "all", "remote"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                      filter === f
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {f === "best" ? `Best matches (${bestCount})` : f === "all" ? "All jobs" : `Remote (${remoteCount})`}
                  </button>
                ))}
              </div>

              {filteredGreenhouse.length > 0 ? (
                <div className="space-y-3">
                  {filteredGreenhouse.map((job, i) => {
                    const cardKey = `gh-${i}`;
                    const isExpanded = expandedCard === cardKey;
                    const scoreClass = job.score >= 80 ? "bg-green-50 text-green-700" : job.score >= 60 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500";

                    return (
                      <div
                        key={cardKey}
                        onClick={() => setExpandedCard(isExpanded ? null : cardKey)}
                        className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm p-5 transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {job.company_domain ? (
                              <img src={`https://www.google.com/s2/favicons?sz=128&domain=${job.company_domain}`} alt="" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <span className="text-sm font-bold text-gray-400">{job.company?.[0]}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {job.company}
                              {job.location_type === "remote" && <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Remote</span>}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {job.location}
                              {job.salary_min && job.salary_max ? ` · ${formatSalary(job.salary_min, job.salary_max, job.salary_currency || "USD")}` : ""}
                            </p>
                          </div>
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${scoreClass}`}>
                            {job.score}%
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-sm text-gray-600 mb-3">{job.why_matched}</p>
                            {job.description_snippet && (
                              <p className="text-xs text-gray-400 mb-3 line-clamp-3">{job.description_snippet}</p>
                            )}
                            {job.matched_skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {job.matched_skills.map((s, si) => (
                                  <span key={si} className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{s}</span>
                                ))}
                              </div>
                            )}
                            {job.apply_link && (
                              <a
                                href={job.apply_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                              >
                                View job
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                  <p className="text-sm font-medium text-gray-700 mb-1">No matching jobs found</p>
                  <p className="text-xs text-gray-400">Try adjusting your skills or experience level above.</p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-8 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stand out when you apply</h3>
              <p className="text-sm text-gray-500 mb-6">
                Get your experience verified by past employers. Verified candidates get seen first.
              </p>
              <Link
                href={token ? "/dashboard?from=match" : "/?auth=signup&next=/dashboard?from=match"}
                className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
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
