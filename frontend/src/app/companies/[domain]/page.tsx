"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Company = {
  name: string;
  domain: string;
  logo_url: string | null;
  website_url: string | null;
  member_since: string;
  verified_employee_count: number;
};

type Job = {
  id: string;
  title: string;
  location: string | null;
  location_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  posted_at: string;
  job_function_name: string | null;
};

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
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CompanyPage() {
  const params = useParams();
  const domain = params.domain as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!domain) return;
    api.getCompanyJobs(domain)
      .then(data => {
        setCompany(data.company);
        setJobs(data.jobs);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [domain]);

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

  if (error || !company) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Company not found</h1>
          <p className="text-gray-500 mb-6">This company is not on Stamp yet.</p>
          <Link href="/jobs" className="text-sm font-medium text-gray-700 hover:text-gray-900">Browse all jobs</Link>
        </div>
      </div>
    );
  }

  const memberSince = company.member_since
    ? new Date(company.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Company header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {(company.logo_url || company.domain) ? (
                <img
                  src={company.logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${company.domain}`}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-2xl font-bold text-gray-400">{company.name[0]}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                <svg viewBox="0 0 24 24" fill="#C8A235" className="w-5 h-5"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>{company.domain}</span>
                {company.website_url && (
                  <>
                    <span>&middot;</span>
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                    >
                      {company.website_url.replace(/^https?:\/\//, "")}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                    </a>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {memberSince && `Member since ${memberSince}`}
                {memberSince && company.verified_employee_count > 0 && " · "}
                {company.verified_employee_count > 0 && `${company.verified_employee_count} verified employee${company.verified_employee_count > 1 ? "s" : ""} on Stamp`}
              </p>
            </div>
          </div>
        </div>

        {/* Open roles */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Open Roles {jobs.length > 0 && <span className="text-gray-400 font-normal">({jobs.length})</span>}
        </h2>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 font-medium mb-1">No open roles right now</p>
            <p className="text-sm text-gray-400">Check back later or browse jobs from other companies.</p>
            <Link href="/jobs" className="inline-block mt-4 text-sm font-medium text-gray-700 hover:text-gray-900">
              Browse all jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {job.location || "No location"} &middot; {job.location_type === "remote" ? "Remote" : job.location_type === "hybrid" ? "Hybrid" : "Onsite"} &middot; {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {job.employment_type.replace(/_/g, "-")} &middot; {job.experience_level}
                  {job.job_function_name ? ` · ${job.job_function_name}` : ""}
                  {job.posted_at ? ` · ${timeAgo(job.posted_at)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
